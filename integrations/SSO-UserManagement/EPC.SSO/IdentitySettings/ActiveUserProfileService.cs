using IdentityServer8.Models;
using IdentityServer8.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using UserManagement.Infrastructure.Persistence;

namespace EPC.SSO.IdentitySettings;

/// <summary>
/// وضعیت حساب در هر درخواست IdentityServer (authorize / token / userinfo) دوباره بررسی می‌شود.
///  • کاربر قفل‌شده یا حذف‌شده با کوکی قبلی‌اش دیگر Code/Token جدید برای سامانه‌ها نمی‌گیرد
///    (قبلاً DefaultProfileService همیشه IsActive=true برمی‌گرداند).
///  • کاربری که باید رمزش را عوض کند (رمز موقت/منقضی) تا تغییر رمز وارد هیچ سامانه‌ای نمی‌شود؛
///    ForcePasswordChangeFilter فقط صفحات MVC را می‌بست و /connect/authorize باز بود.
/// نتیجه‌ی کوئری برای هر کاربر ۳۰ ثانیه کش می‌شود.
/// </summary>
public sealed class ActiveUserProfileService(
    ILogger<DefaultProfileService> logger,
    IDbContextFactory<UserManagementCommandContext> contextFactory,
    IMemoryCache cache) : DefaultProfileService(logger)
{
    private static readonly TimeSpan CacheFor = TimeSpan.FromSeconds(30);

    public override async Task IsActiveAsync(IsActiveContext context)
    {
        if (context.Caller == IdentityServer8.IdentityServerConstants.ProfileIsActiveCallers.AuthorizeEndpoint &&
            string.Equals(context.Subject.FindFirst("PasswordExpired")?.Value, "true", StringComparison.OrdinalIgnoreCase))
        {
            context.IsActive = false;
            return;
        }

        if (!Guid.TryParse(context.Subject.FindFirst("sub")?.Value, out var userGuid))
        {
            context.IsActive = false;
            return;
        }

        context.IsActive = await IsUserActiveAsync(userGuid);
    }

    private async Task<bool> IsUserActiveAsync(Guid userGuid)
    {
        var key = $"profile:active:{userGuid:N}";
        if (cache.TryGetValue(key, out bool active)) return active;

        try
        {
            await using var db = await contextFactory.CreateDbContextAsync();
            active = await db.Users.AsNoTracking()
                .AnyAsync(u => u.Guid == userGuid && !u.IsRemoved
                               && u.IsLocked != Epc.Domain.AuditableAggregateRootBase<int>.LockStates.Lock);
        }
        catch (Exception ex)
        {
            // خطای دیتابیس نباید همه را از سامانه‌ها بیرون کند
            Logger.LogError(ex, "Checking account state of {User} failed", userGuid);
            return true;
        }

        cache.Set(key, active, new MemoryCacheEntryOptions { Size = 1, AbsoluteExpirationRelativeToNow = CacheFor });
        return active;
    }
}
