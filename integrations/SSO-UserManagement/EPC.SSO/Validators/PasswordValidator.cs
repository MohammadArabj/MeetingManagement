using System.Net;
using System.Net.Sockets;
using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Text;
using Epc.Application.Setting;
using Epc.Domain;
using Epc.Identity;
using EPC.SSO.Models;
using EPC.SSO.SettingModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using UserManagement.Domain.UserAgg;
using UserManagement.Infrastructure.Persistence;

namespace EPC.SSO.Validators;

/// <summary>
/// اعتبارسنجی ورود.
///
/// اصلاحات نسبت به نسخه‌ی قبلی:
///  • تماماً Async (قبلاً SaveChanges/FirstOrDefault همگام بود و زیر بار Thread Pool را قفل می‌کرد).
///  • تنظیمات امنیتی فقط یک‌بار خوانده می‌شود (قبلاً در هر ورود چند کوئری Settings).
///  • 🔴 محدودیت IP و زمان ورود واقعاً اعمال می‌شود. قبلاً Navigationهای IpRestrictions /
///    TimeRestrictions / PositionGroups بارگذاری نمی‌شدند و همیشه خالی بودند، یعنی هیچ
///    محدودیتی هرگز اعمال نمی‌شد.
///  • مقایسه‌ی بازه‌ی IP عددی و صحیح است (قبلاً بایت‌به‌بایت مستقل مقایسه می‌شد که غلط است).
///  • محدودیت زمانی با ساعت محلی سرور (ایران) مقایسه می‌شود، نه UTC (۳.۵ ساعت اختلاف).
///  • آدرس‌های IPv4-mapped-IPv6 (‎::ffff:10.0.0.5) به IPv4 تبدیل می‌شوند.
///  • مقایسه‌ی کلید ورود خارجی Constant-time است.
///  • شمارنده‌ی ورود ناموفق اتمیک افزایش می‌یابد (قبلاً با درخواست‌های هم‌زمان چند خطا یک خطا حساب می‌شد
///    و قفل حساب دور زده می‌شد).
///  • کلید یک‌بارمصرف (ورود از برنامه‌های دیگر) فقط ۵ رقم است؛ بعد از چند کلید اشتباه برای یک کد پرسنلی،
///    کلید فعلی باطل می‌شود تا حدس زدن آن ممکن نباشد. محدودیت IP/زمان هم برای این ورود اعمال می‌شود.
///  • کاربر بدون شرکت (Company=null) دیگر خطای 500 نمی‌دهد.
/// </summary>
public sealed class PasswordValidator(
    UserManagementCommandContext context,
    IPasswordHasher passwordHasher,
    PortalDbContext portalDbContext,
    IHttpContextAccessor httpContextAccessor,
    ISettingService settingService,
    IMemoryCache cache) : IPasswordValidator
{
    private const int MaxKeyAttempts = 5;
    private static readonly TimeSpan KeyAttemptWindow = TimeSpan.FromMinutes(15);

    private const string InvalidCredentials = "مشخصات ورود اشتباه است. لطفا دوباره تلاش کنید.";
    private const string LockedMessage = "کاربر قفل شده است، لطفا به راهبر سیستم اطلاع رسانی کنید.";

    public async Task<PasswordValidationResult> ValidateAsync(string username, string password, CancellationToken cancellationToken = default)
    {
        var result = new PasswordValidationResult();
        var settings = settingService.Fetch<SecuritySettingViewModel>();

        var user = await LoadUserAsync(username, cancellationToken);
        if (user is null)
        {
            // جلوگیری از Timing Attack برای تشخیص وجود کاربر: هزینه‌ی هش را به‌هرحال پرداخت می‌کنیم.
            passwordHasher.Hash(password);
            return result.Failed(InvalidCredentials);
        }

        if (user.IsLocked == AuditableAggregateRootBase<int>.LockStates.Lock)
            return result.Failed(LockedMessage);

        if (user.FailedLoginAttempts >= settings.LoginAttemptsCountLimit)
        {
            user.Lock(user.Guid);
            await context.SaveChangesAsync(cancellationToken);
            return result.Failed(LockedMessage);
        }

        var clientIp = GetClientIp();
        var unitTitle = await GetUnitTitleAsync(user.UnitId, cancellationToken);

        var activePassword = user.Passwords.FirstOrDefault(x => x.IsActive == EntityBase<long>.ActiveStates.Active);
        if (activePassword is null)
        {
            // پیام یکسان با رمز اشتباه (جلوگیری از شناسایی کدهای پرسنلی معتبر)
            passwordHasher.Hash(password);
            return result.Failed(InvalidCredentials);
        }

        var (verified, _) = passwordHasher.Check(activePassword.Password, password + user.PersonnelCode);
        if (!verified)
        {
            var attempts = await RegisterFailedAttemptAsync(user.Id, cancellationToken);
            if (attempts >= settings.LoginAttemptsCountLimit)
            {
                user.Lock(user.Guid);
                await context.SaveChangesAsync(cancellationToken);
                return result.Failed(LockedMessage);
            }

            user.OpenSession(user.Guid, user.NationalCode, $"{user.FirstName} {user.LastName}",
                user.PersonnelCode, CompanyTitle(user), unitTitle, false, clientIp?.ToString());

            await context.SaveChangesAsync(cancellationToken);
            return result.Failed(InvalidCredentials);
        }

        var restriction = await CheckRestrictionsAsync(user, clientIp, cancellationToken);
        if (restriction is not null)
            return result.Failed(restriction);

        // قبل از ثبت Session جدید بررسی می‌کنیم آیا قبلاً ورود موفقی داشته است.
        var isFirstLogin = !await context.Users
            .AsNoTracking()
            .Where(x => x.Id == user.Id)
            .SelectMany(x => x.Sessions)
            .AnyAsync(x => x.IsSuccessful, cancellationToken);

        user.OpenSession(user.Guid, user.NationalCode, $"{user.FirstName} {user.LastName}",
            user.PersonnelCode, CompanyTitle(user), unitTitle, true, clientIp?.ToString(), settings.TokenExpiryTime);

        if (isFirstLogin || activePassword.IsExpired() || user.PasswordExpired) user.ShouldChangePassword();
        else user.PasswordRenewed();

        user.ResetFailedLoginAttempts(user.Guid);
        await context.SaveChangesAsync(cancellationToken);

        return result.Success();
    }

    public async Task<PasswordValidationResult> ExternalValidateAsync(string userName, string key, CancellationToken cancellationToken = default)
    {
        var result = new PasswordValidationResult();
        var settings = settingService.Fetch<SecuritySettingViewModel>();

        if (string.IsNullOrWhiteSpace(key) || !int.TryParse(userName, out var personnelNo))
            return result.Failed("شناسه وارد شده نامعتبر است.");

        var user = await LoadUserAsync(userName, cancellationToken);
        if (user is null)
            return result.Failed(InvalidCredentials);

        if (user.IsLocked == AuditableAggregateRootBase<int>.LockStates.Lock)
            return result.Failed(LockedMessage);

        if (user.FailedLoginAttempts >= settings.LoginAttemptsCountLimit)
        {
            user.Lock(user.Guid);
            await context.SaveChangesAsync(cancellationToken);
            return result.Failed(LockedMessage);
        }

        // کلید یک‌بارمصرف SYSTEM21
        var storedKey = await portalDbContext.SYSTEM21
            .AsNoTracking()
            .Where(c => c.Personeli_Number == personnelNo)
            .Select(c => c.RandomNumber)
            .FirstOrDefaultAsync(cancellationToken);

        if (storedKey is null || !FixedTimeEquals(storedKey, key))
        {
            await RegisterFailedKeyAsync(personnelNo, cancellationToken);
            return result.Failed("شناسه وارد شده نامعتبر است.");
        }

        // مصرف اتمیک: دو درخواست هم‌زمان با یک کلید فقط یک ورود می‌سازند
        var consumed = await portalDbContext.SYSTEM21
            .Where(c => c.Personeli_Number == personnelNo && c.RandomNumber == storedKey)
            .ExecuteUpdateAsync(u => u.SetProperty(c => c.RandomNumber, (string?)null), cancellationToken);
        if (consumed == 0)
            return result.Failed("شناسه وارد شده نامعتبر است.");
        cache.Remove(KeyAttemptsKey(personnelNo));

        var clientIp = GetClientIp();
        var restriction = await CheckRestrictionsAsync(user, clientIp, cancellationToken);
        if (restriction is not null)
            return result.Failed(restriction);

        var unitTitle = await GetUnitTitleAsync(user.UnitId, cancellationToken);
        user.OpenSession(user.Guid, user.NationalCode, $"{user.FirstName} {user.LastName}",
            user.PersonnelCode, CompanyTitle(user), unitTitle, true, clientIp?.ToString(), settings.TokenExpiryTime);

        user.ResetFailedLoginAttempts(user.Guid);
        await context.SaveChangesAsync(cancellationToken);

        return result.Success();
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private static string CompanyTitle(User user) => user.Company?.Title ?? string.Empty;

    /// <summary>افزایش اتمیک شمارنده در دیتابیس و برگرداندن مقدار جدید</summary>
    private async Task<int> RegisterFailedAttemptAsync(int userId, CancellationToken cancellationToken)
    {
        await context.Users
            .Where(u => u.Id == userId)
            .ExecuteUpdateAsync(u => u.SetProperty(x => x.FailedLoginAttempts, x => x.FailedLoginAttempts + 1), cancellationToken);

        return await context.Users.AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => u.FailedLoginAttempts)
            .FirstAsync(cancellationToken);
    }

    private static string KeyAttemptsKey(int personnelNo) => $"login:key-attempts:{personnelNo}";

    /// <summary>بعد از چند کلید اشتباه، کلید فعلی باطل می‌شود (کلید ۵ رقمی قابل حدس است)</summary>
    private async Task RegisterFailedKeyAsync(int personnelNo, CancellationToken cancellationToken)
    {
        var counter = cache.GetOrCreate(KeyAttemptsKey(personnelNo), e =>
        {
            e.AbsoluteExpirationRelativeToNow = KeyAttemptWindow;
            e.Size = 1;
            return new StrongBox<int>();
        })!;

        if (Interlocked.Increment(ref counter.Value) < MaxKeyAttempts) return;

        await portalDbContext.SYSTEM21
            .Where(c => c.Personeli_Number == personnelNo)
            .ExecuteUpdateAsync(u => u.SetProperty(c => c.RandomNumber, (string?)null), cancellationToken);
        cache.Remove(KeyAttemptsKey(personnelNo));
    }

    /// <summary>محدودیت سمت، زمان و IP (برای هر دو نوع ورود). null یعنی مجاز.</summary>
    private async Task<string?> CheckRestrictionsAsync(User user, IPAddress? clientIp, CancellationToken cancellationToken)
    {
        if (user.IsSuperAdmin) return null;

        var position = user.Positions.Select(p => p.Position).FirstOrDefault();
        if (position is null)
            return "برای کاربر وارد شده هیچ سمتی ثبت نشده است.";

        var groupIds = await context.PositionGroups
            .AsNoTracking()
            .Where(pg => pg.PositionId == position.Id)
            .Select(pg => pg.GroupId)
            .ToListAsync(cancellationToken);

        if (!await IsWithinTimeRestrictionsAsync(position.Id, groupIds, cancellationToken))
            return "خارج از زمان‌های مجاز برای ورود به سیستم.";

        if (!await IsWithinIpRestrictionsAsync(position.Id, groupIds, clientIp, cancellationToken))
            return "آی‌پی شما مجاز به دسترسی به سیستم نیست.";

        return null;
    }

    private Task<User?> LoadUserAsync(string personnelCode, CancellationToken cancellationToken) =>
        context.Users
            .Include(x => x.Passwords)
            .Include(x => x.Company)
            .Include(u => u.Positions).ThenInclude(c => c.Position)
            .AsSplitQuery()
            .FirstOrDefaultAsync(x => x.PersonnelCode == personnelCode && !x.IsRemoved, cancellationToken);

    private async Task<string> GetUnitTitleAsync(long? unitId, CancellationToken cancellationToken)
    {
        if (unitId is null) return string.Empty;
        return await context.Units.AsNoTracking()
            .Where(x => x.Id == unitId)
            .Select(x => x.Title)
            .FirstOrDefaultAsync(cancellationToken) ?? string.Empty;
    }

    private IPAddress? GetClientIp()
    {
        var ip = httpContextAccessor.HttpContext?.Connection.RemoteIpAddress;
        return ip is { IsIPv4MappedToIPv6: true } ? ip.MapToIPv4() : ip;
    }

    private async Task<bool> IsWithinTimeRestrictionsAsync(int positionId, List<int> groupIds, CancellationToken cancellationToken)
    {
        var restrictions = await context.TimeRestrictions
            .AsNoTracking()
            .Where(tr => tr.PositionId == positionId || (tr.GroupId != null && groupIds.Contains(tr.GroupId.Value)))
            .Select(tr => new { tr.DayOfWeek, tr.StartTime, tr.EndTime })
            .ToListAsync(cancellationToken);

        if (restrictions.Count == 0) return true;

        var now = DateTime.Now; // ساعت محلی سرور
        return restrictions.Any(tr => tr.DayOfWeek == now.DayOfWeek && now.TimeOfDay >= tr.StartTime && now.TimeOfDay <= tr.EndTime);
    }

    private async Task<bool> IsWithinIpRestrictionsAsync(int positionId, List<int> groupIds, IPAddress? clientIp, CancellationToken cancellationToken)
    {
        var restrictions = await context.IpRestrictions
            .AsNoTracking()
            .Where(ir => ir.PermissionId == null &&
                         (ir.PositionId == positionId || (ir.GroupId != null && groupIds.Contains(ir.GroupId.Value))))
            .Select(ir => new { ir.StartIp, ir.EndIp })
            .ToListAsync(cancellationToken);

        if (restrictions.Count == 0) return true;
        if (clientIp is null) return false;

        return restrictions.Any(r => IsInRange(clientIp, r.StartIp, r.EndIp));
    }

    internal static bool IsInRange(IPAddress ip, string? startIp, string? endIp)
    {
        if (!IPAddress.TryParse(startIp, out var start) || !IPAddress.TryParse(endIp, out var end))
            return false;

        if (start.IsIPv4MappedToIPv6) start = start.MapToIPv4();
        if (end.IsIPv4MappedToIPv6) end = end.MapToIPv4();

        if (ip.AddressFamily != start.AddressFamily || ip.AddressFamily != end.AddressFamily)
            return false;

        var value = ip.GetAddressBytes();
        return Compare(value, start.GetAddressBytes()) >= 0 && Compare(value, end.GetAddressBytes()) <= 0;
    }

    private static int Compare(byte[] a, byte[] b)
    {
        for (var i = 0; i < a.Length; i++)
        {
            var diff = a[i].CompareTo(b[i]);
            if (diff != 0) return diff;
        }
        return 0;
    }

    private static bool FixedTimeEquals(string a, string b)
        => CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(a), Encoding.UTF8.GetBytes(b));
}
