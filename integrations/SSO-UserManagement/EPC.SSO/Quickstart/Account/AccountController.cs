using System.Security.Claims;
using System.Security.Cryptography;
using Epc.Application.Setting;
using Epc.Core.Exceptions;
using Epc.Identity;
using EPC.SSO.Facades;
using EPC.SSO.Infrastructure;
using EPC.SSO.Quickstart.Home;
using EPC.SSO.Services;
using EPC.SSO.SettingModels;
using EPC.SSO.Validators;
using IdentityServer8;
using IdentityServer8.Events;
using IdentityServer8.Extensions;
using IdentityServer8.Models;
using IdentityServer8.Services;
using IdentityServer8.Stores;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Net.Http.Headers;
using UserManagement.Domain.UserAgg;
using UserManagement.Infrastructure.Persistence;

namespace EPC.SSO.Quickstart.Account;

public class ForgotPasswordRequest
{
    public string PersonnelCode { get; set; } = string.Empty;
    public string? Phone { get; set; }
}

// ⚠️ [AllowAnonymous] در سطح کلاس حذف شد: در ASP.NET Core وجود آن، [Authorize] اکشن‌ها را بی‌اثر می‌کرد.
[SecurityHeaders]
public class AccountController(
    IIdentityServerInteractionService interaction,
    IClientStore clientStore,
    IAuthenticationSchemeProvider schemeProvider,
    IEventService events,
    IPasswordValidator passwordValidator,
    UserManagementCommandContext dbContext,
    ISettingService settingService,
    IPasswordHasher passwordHasher,
    IUserPortalQueryFacade userPortalQueryFacade,
    LoginAnnouncementStore loginAnnouncements,
    AnnouncementFileCache fileCache,
    AnnouncementApiService announcementApiService,
    SmsApiService smsApiService,
    IMemoryCache memoryCache,
    IConfiguration configuration,
    DashboardPrefetcher dashboardPrefetcher,
    ILogger<AccountController> logger) : Controller
{
    private const string CaptchaSessionKey = "login.captcha";
    private const string CaptchaChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private const string GenericForgotMessage =
        "اگر اطلاعات واردشده صحیح باشد، رمز موقت به شماره همراه ثبت‌شده ارسال می‌شود.";

    private string CompanyName => configuration["Portal:CompanyName"] ?? "شرکت پتروشیمی اصفهان";

    // ════════════════════════════════════════════════════════════════════════
    //  GET /Account/Login
    //  هیچ I/O شبکه‌ای ندارد؛ اطلاعیه‌ها از حافظه (LoginAnnouncementStore) رندر می‌شوند.
    // ════════════════════════════════════════════════════════════════════════
    [HttpGet]
    public async Task<IActionResult> Login(int? userName = null, string? key = null, string? returnUrl = null)
    {
        var authContext = await interaction.GetAuthorizationContextAsync(returnUrl);

        var surveyUser = authContext?.Parameters.Get("survey_user");
        var surveyKey = authContext?.Parameters.Get("survey_key");

        if (!string.IsNullOrWhiteSpace(surveyUser) && !string.IsNullOrWhiteSpace(surveyKey))
        {
            var result = await TryExternalKeyLoginAsync(surveyUser, surveyKey, returnUrl, authContext);
            if (result is not null) return result;
        }
        else if (userName is not null && !string.IsNullOrWhiteSpace(key))
        {
            var result = await TryExternalKeyLoginAsync(userName.Value.ToString(), key, returnUrl, authContext);
            if (result is not null) return result;
        }

        if (User.Identity?.IsAuthenticated == true && authContext is null)
            return RedirectToAction("Index", "Grants");

        var vm = await BuildLoginViewModelAsync(returnUrl);
        return View(vm);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  POST /Account/Login
    // ════════════════════════════════════════════════════════════════════════
    [HttpPost]
    [ValidateAntiForgeryToken]
    [EnableRateLimiting(RateLimitPolicies.Login)]
    public async Task<IActionResult> Login(LoginInputModel model, string button)
    {
        var authContext = await interaction.GetAuthorizationContextAsync(model.ReturnUrl);

        if (button != "login")
        {
            if (authContext is null) return Redirect("~/");
            await interaction.DenyAuthorizationAsync(authContext, AuthorizationError.AccessDenied);
            return authContext.IsNativeClient()
                ? this.LoadingPage("Redirect", model.ReturnUrl!)
                : Redirect(model.ReturnUrl!);
        }

        // 🔴 قبلاً HasCaptcha و کد Captcha هر دو از فیلد مخفی فرم خوانده می‌شدند و قابل دور زدن بودند.
        //    حالا نیاز به Captcha از تعداد تلاش ناموفق در دیتابیس و کد مورد انتظار از Session خوانده می‌شود.
        var captchaRequired = ModelState.IsValid && await IsCaptchaRequiredAsync(model.Username);
        if (captchaRequired && !ValidateAndConsumeCaptcha(model.EnteredCaptcha))
        {
            await events.RaiseAsync(new UserLoginFailureEvent(model.Username, "invalid captcha", clientId: authContext?.Client.ClientId));
            ModelState.AddModelError(string.Empty,
                string.IsNullOrWhiteSpace(model.EnteredCaptcha) ? "لطفاً کد امنیتی را وارد کنید." : AccountOptions.InvalidCaptchaErrorMessage);
        }

        if (!ModelState.IsValid)
            return await FailedLoginViewAsync(model);

        var validation = await passwordValidator.ValidateAsync(model.Username, model.Password, HttpContext.RequestAborted);
        if (!validation.Succeeded)
        {
            await events.RaiseAsync(new UserLoginFailureEvent(model.Username, validation.Message, clientId: authContext?.Client.ClientId));
            ModelState.AddModelError(string.Empty, validation.Message);
            return await FailedLoginViewAsync(model);
        }

        var user = await LoadUserForSignInAsync(model.Username);
        if (user is null)
        {
            ModelState.AddModelError(string.Empty, "مشخصات ورود اشتباه است.");
            return await FailedLoginViewAsync(model);
        }

        await SignInUserAsync(user);
        await events.RaiseAsync(new UserLoginSuccessEvent(user.PersonnelCode, user.Guid.ToString(), user.PersonnelCode,
            clientId: authContext?.Client.ClientId));

        if (user.PasswordExpired)
            return RedirectToAction(nameof(ChangePassword));

        return ResolveRedirect(authContext, model.ReturnUrl);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  اطلاعیه‌ها و فایل‌های صفحه‌ی ورود
    // ════════════════════════════════════════════════════════════════════════

    /// <summary>سازگاری با نسخه‌های قبلی صفحه — همیشه از حافظه.</summary>
    [HttpGet]
    [ResponseCache(Duration = 30, Location = ResponseCacheLocation.Any)]
    public IActionResult GetLoginAnnouncements()
        => Json(new { items = loginAnnouncements.Current.Items, slideIntervalMs = GetSlideIntervalMs() });

    /// <summary>سازگاری با نسخه‌های قبلی صفحه — Metadata از همان snapshot حافظه.</summary>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult GetLoginFileMetas([FromBody] List<AnnouncementFileDto>? files)
    {
        var snapshot = loginAnnouncements.Current;
        var result = (files ?? [])
            .Select(f => snapshot.FindFile(f.FileGuid))
            .Where(f => f is not null)
            .Take(20)
            .ToList();
        return Json(result);
    }

    /// <summary>
    /// فقط فایل‌های متعلق به اطلاعیه‌های فعال صفحه‌ی ورود (Anonymous).
    /// از کش دیسکی محلی با PhysicalFile سرو می‌شود (Range + ETag + کش مرورگر).
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> FileProxy(Guid guid, CancellationToken cancellationToken)
    {
        if (guid == Guid.Empty) return NotFound();

        var file = loginAnnouncements.Current.FindFile(guid);
        if (file is null) return NotFound();

        if (fileCache.TryGet(guid, out var cached) && cached is not null)
            return CachedFileResult(cached, isPublic: true);

        var meta = new FileMeta { Guid = guid, ContentType = file.ContentType, FileName = file.DisplayName, FileSize = file.FileSize };
        cached = await fileCache.GetOrDownloadAsync(guid, meta, cancellationToken);
        if (cached is not null)
            return CachedFileResult(cached, isPublic: true);

        // فایل بزرگ‌تر از سقف کش → Stream مستقیم
        return await StreamFromUpstreamAsync(guid, cancellationToken);
    }

    /// <summary>
    /// Webhook اختیاری برای سامانه‌ی اطلاعیه: بعد از انتشار/ویرایش صدا زده شود تا صفحه‌ی ورود فوراً به‌روز شود.
    /// Header: X-Refresh-Key = Announcements:RefreshKey
    /// </summary>
    [HttpPost]
    [IgnoreAntiforgeryToken]
    public IActionResult RefreshLoginAnnouncements([FromHeader(Name = "X-Refresh-Key")] string? refreshKey)
    {
        var expected = configuration["Announcements:RefreshKey"];
        if (string.IsNullOrWhiteSpace(expected) || string.IsNullOrWhiteSpace(refreshKey) ||
            !CryptographicOperations.FixedTimeEquals(System.Text.Encoding.UTF8.GetBytes(expected), System.Text.Encoding.UTF8.GetBytes(refreshKey)))
            return Unauthorized();

        loginAnnouncements.RequestRefresh();
        return Ok(new { success = true });
    }

    [HttpGet]
    public IActionResult RefreshCaptcha()
    {
        var text = NewCaptcha();
        return Json(new { text });
    }

    // ════════════════════════════════════════════════════════════════════════
    //  فراموشی رمز
    //  🔴 قبلاً هر کسی با داشتن فقط «کد پرسنلی» رمز هر کاربری را ریست می‌کرد، بدون محدودیت.
    //     حالا: Rate Limit برای هر IP، Cooldown برای هر حساب، تطبیق ۴ رقم آخر موبایل (در صورت فعال بودن)،
    //     و پیام یکسان برای جلوگیری از شناسایی کدهای پرسنلی معتبر.
    // ════════════════════════════════════════════════════════════════════════
    [HttpPost]
    [ValidateAntiForgeryToken]
    [EnableRateLimiting(RateLimitPolicies.ForgotPassword)]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        var code = request.PersonnelCode?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(code) || code.Length > 20)
            return Ok(new { success = false, message = "کد پرسنلی الزامی است." });

        var requireMobile = configuration.GetValue("ForgotPassword:RequireMobileLast4", true);
        var mobileLast4 = new string((request.Phone ?? string.Empty).Where(char.IsDigit).ToArray());
        if (requireMobile && mobileLast4.Length != 4)
            return Ok(new { success = false, message = "چهار رقم آخر شماره همراه را وارد کنید." });

        var cooldownKey = $"forgot:{code}";
        if (memoryCache.TryGetValue(cooldownKey, out _))
            return Ok(new { success = true, message = GenericForgotMessage });

        memoryCache.Set(cooldownKey, true, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(configuration.GetValue("ForgotPassword:CooldownMinutes", 10)),
            Size = 1
        });

        var user = await dbContext.Users
            .Include(x => x.Passwords)
            .FirstOrDefaultAsync(x => x.PersonnelCode == code && !x.IsRemoved);

        var mobile = new string((user?.Mobile ?? string.Empty).Where(char.IsDigit).ToArray());
        var mobileMatches = mobile.Length >= 4 && (!requireMobile || mobile.EndsWith(mobileLast4, StringComparison.Ordinal));

        if (user is null || !mobileMatches)
        {
            logger.LogWarning("[ForgotPassword] درخواست نامعتبر برای {Code} از {Ip}", code, HttpContext.Connection.RemoteIpAddress);
            return Ok(new { success = true, message = GenericForgotMessage });
        }

        var tempPassword = GenerateTempPassword();
        try
        {
            var setting = settingService.Fetch<SecuritySettingViewModel>();
            user.SetPassword(Guid.Empty, tempPassword, setting.PasswordLifetimeDays, setting.ForbiddenOldPasswordsCount,
                setting.PasswordStrengthLevel, passwordHasher);
            await dbContext.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[ForgotPassword] بازنشانی رمز {Code} ناموفق بود", code);
            return Ok(new { success = false, message = "خطا در بازنشانی رمز عبور. لطفاً با پشتیبانی تماس بگیرید." });
        }

        var sent = await smsApiService.SendAsync(user.Mobile!, $"رمز موقت شما: {tempPassword}\nپس از ورود رمز خود را تغییر دهید.");
        if (!sent)
        {
            logger.LogError("[ForgotPassword] ارسال پیامک برای {Code} ناموفق بود", code);
            return Ok(new { success = false, message = "ارسال پیامک با خطا مواجه شد. با پشتیبانی تماس بگیرید." });
        }

        return Ok(new { success = true, message = GenericForgotMessage });
    }

    // ════════════════════════════════════════════════════════════════════════
    //  خروج
    // ════════════════════════════════════════════════════════════════════════
    [HttpGet]
    public async Task<IActionResult> Logout(string? logoutId)
    {
        if (User.Identity?.IsAuthenticated != true)
            return RedirectToAction(nameof(Login));

        await CloseSessionsAsync();
        await SignOutAsync();

        if (!string.IsNullOrWhiteSpace(logoutId))
        {
            var ctx = await interaction.GetLogoutContextAsync(logoutId);
            if (!string.IsNullOrWhiteSpace(ctx?.PostLogoutRedirectUri))
                return Redirect(ctx.PostLogoutRedirectUri);
        }

        return RedirectToAction(nameof(Login));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Logout(LogoutInputModel model)
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            await CloseSessionsAsync();
            await SignOutAsync();
        }
        return RedirectToAction(nameof(Login));
    }

    [HttpGet]
    public IActionResult AccessDenied() => View();

    // ════════════════════════════════════════════════════════════════════════
    //  تغییر رمز
    // ════════════════════════════════════════════════════════════════════════
    [HttpGet]
    [Authorize]
    public IActionResult ChangePassword() => View();

    [HttpPost]
    [Authorize]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ChangePassword(SettingModels.ChangePassword command)
    {
        if (!ModelState.IsValid)
            return View(command);

        if (command.Password != command.RePassword)
        {
            ModelState.AddModelError(string.Empty, "رمز عبور جدید و تکرار آن یکسان نیستند.");
            return View(command);
        }

        if (!Guid.TryParse(User.FindFirst("sub")?.Value, out var userGuid))
            return RedirectToAction(nameof(Login));

        var user = await dbContext.Users
            .Include(x => x.Passwords)
            .FirstOrDefaultAsync(x => x.Guid == userGuid);

        if (user is null) return RedirectToAction(nameof(Login));

        var setting = settingService.Fetch<SecuritySettingViewModel>();
        try
        {
            user.GuardAgainstInvalidCurrentPassword(command.CurrentPassword, passwordHasher);
            user.SetPassword(userGuid, command.Password, setting.PasswordLifetimeDays, setting.ForbiddenOldPasswordsCount,
                setting.PasswordStrengthLevel, passwordHasher);
            await dbContext.SaveChangesAsync();
        }
        catch (BusinessException e)
        {
            ModelState.AddModelError(string.Empty, e.Message);
            return View(command);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[ChangePassword] خطا برای {User}", userGuid);
            ModelState.AddModelError(string.Empty, "خطایی در تغییر رمز عبور رخ داد. لطفاً دوباره تلاش کنید.");
            return View(command);
        }

        await HttpContext.SignOutAsync();
        return RedirectToAction(nameof(Login));
    }

    [HttpPost]
    [Authorize]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ResetFarzinPassword([FromServices] FarzinApiService farzinService)
    {
        var personnelCode = User.FindFirstValue("PersonnelCode");
        if (string.IsNullOrEmpty(personnelCode))
            return Json(new { success = false, message = "کاربر شناسایی نشد" });

        var mobile = await dbContext.Users.AsNoTracking()
            .Where(x => x.PersonnelCode == personnelCode && !x.IsRemoved)
            .Select(x => x.Mobile)
            .FirstOrDefaultAsync();

        var (success, message) = await farzinService.ResetAndNotifyAsync(personnelCode, mobile ?? string.Empty);
        return Json(new { success, message });
    }

    // ════════════════════════════════════════════════════════════════════════
    //  Private
    // ════════════════════════════════════════════════════════════════════════

    private async Task<IActionResult?> TryExternalKeyLoginAsync(string userName, string key, string? returnUrl, AuthorizationRequest? authContext)
    {
        var validation = await passwordValidator.ExternalValidateAsync(userName, key, HttpContext.RequestAborted);
        if (!validation.Succeeded)
        {
            await events.RaiseAsync(new UserLoginFailureEvent(userName, validation.Message, clientId: authContext?.Client.ClientId));
            ModelState.AddModelError(string.Empty, validation.Message);
            return null;
        }

        var user = await LoadUserForSignInAsync(userName);
        if (user is null)
        {
            ModelState.AddModelError(string.Empty, "کاربر یافت نشد.");
            return null;
        }

        await SignInUserAsync(user);
        await events.RaiseAsync(new UserLoginSuccessEvent(user.PersonnelCode, user.Guid.ToString(), user.PersonnelCode,
            clientId: authContext?.Client.ClientId));

        if (user.PasswordExpired)
            return RedirectToAction(nameof(ChangePassword));

        return ResolveRedirect(authContext, returnUrl);
    }

    private Task<User?> LoadUserForSignInAsync(string personnelCode) =>
        dbContext.Users
            .Include(c => c.Positions).ThenInclude(up => up.Position)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.PersonnelCode == personnelCode && !x.IsRemoved);

    private async Task SignInUserAsync(User user)
    {
        var portalIdentity = await userPortalQueryFacade.GetIdentityUser(user.Guid);

        var activatedPosition = portalIdentity?.ActivatedPositionGuid
            ?? (user.Positions.Count > 1
                ? user.Positions.Where(c => !c.Position.IsSuperAdmin).Select(c => c.Position.Guid).FirstOrDefault()
                : user.Positions.Select(c => c.Position.Guid).FirstOrDefault());

        var claims = new List<Claim>
        {
            new("ActivatedPosition", activatedPosition.ToString()),
            new("IsDelegate", "false"),
            new("DelegationId", string.Empty),
            new("FLName", portalIdentity?.FullName ?? $"{user.FirstName} {user.LastName}"),
            new("PersonnelCode", portalIdentity?.PersonnelCode ?? user.PersonnelCode),
            new("PasswordExpired", (portalIdentity?.PasswordExpired ?? user.PasswordExpired).ToString()),
            new("IsSuperAdmin", (portalIdentity?.IsSuperAdmin ?? user.IsSuperAdmin).ToString())
        };

        foreach (var permission in portalIdentity?.Permissions ?? [])
            claims.Add(new Claim("Permissions", permission));

        await HttpContext.SignInAsync(new IdentityServerUser(user.Guid.ToString())
        {
            DisplayName = user.PersonnelCode,
            AdditionalClaims = claims
        }, null);

        // داده‌های داشبورد در پس‌زمینه آماده می‌شوند تا کاربر پس از ورود منتظر APIها نماند
        dashboardPrefetcher.Prefetch(user.Guid, activatedPosition,
            portalIdentity?.IsSuperAdmin ?? user.IsSuperAdmin, portalIdentity?.PersonnelCode ?? user.PersonnelCode);
    }

    private IActionResult ResolveRedirect(AuthorizationRequest? authContext, string? returnUrl)
    {
        if (authContext is not null)
            return authContext.IsNativeClient()
                ? this.LoadingPage("Redirect", returnUrl!)
                : Redirect(returnUrl!);

        if (!string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl))
            return Redirect(returnUrl);

        return RedirectToAction("Index", "Grants");
    }

    private async Task<IActionResult> FailedLoginViewAsync(LoginInputModel model)
    {
        var vm = await BuildLoginViewModelAsync(model.ReturnUrl);
        vm.Username = model.Username;
        vm.HasCaptcha = !string.IsNullOrWhiteSpace(model.Username) && await IsCaptchaRequiredAsync(model.Username);
        if (vm.HasCaptcha) vm.CaptchaText = NewCaptcha();
        return View("Login", vm);
    }

    private async Task<bool> IsCaptchaRequiredAsync(string username)
    {
        var limit = settingService.Fetch<SecuritySettingViewModel>().MaxLoginAttemptsBeforeCaptcha;
        if (limit <= 0) return false;

        var attempts = await dbContext.Users.AsNoTracking()
            .Where(x => x.PersonnelCode == username && !x.IsRemoved)
            .Select(x => x.FailedLoginAttempts)
            .FirstOrDefaultAsync();

        return attempts >= limit;
    }

    private string NewCaptcha()
    {
        var text = new string(Enumerable.Range(0, 5).Select(_ => CaptchaChars[RandomNumberGenerator.GetInt32(CaptchaChars.Length)]).ToArray());
        HttpContext.Session.SetString(CaptchaSessionKey, text);
        return text;
    }

    private bool ValidateAndConsumeCaptcha(string? entered)
    {
        var expected = HttpContext.Session.GetString(CaptchaSessionKey);
        HttpContext.Session.Remove(CaptchaSessionKey); // یک‌بارمصرف
        return !string.IsNullOrWhiteSpace(expected) &&
               !string.IsNullOrWhiteSpace(entered) &&
               string.Equals(expected, entered.Trim(), StringComparison.OrdinalIgnoreCase);
    }

    private static string GenerateTempPassword()
    {
        const string lower = "abcdefghjkmnpqrstuvwxyz", upper = "ABCDEFGHJKMNPQRSTUVWXYZ", digits = "23456789", special = "@#$%";
        var all = lower + upper + digits;
        var chars = new List<char>
        {
            upper[RandomNumberGenerator.GetInt32(upper.Length)],
            lower[RandomNumberGenerator.GetInt32(lower.Length)],
            digits[RandomNumberGenerator.GetInt32(digits.Length)],
            special[RandomNumberGenerator.GetInt32(special.Length)]
        };
        while (chars.Count < 10) chars.Add(all[RandomNumberGenerator.GetInt32(all.Length)]);
        return new string(chars.OrderBy(_ => RandomNumberGenerator.GetInt32(1000)).ToArray());
    }

    private int GetSlideIntervalMs()
    {
        var s = settingService.Fetch<AnnouncementSettingViewModel>().LoginAnnouncementSlideIntervalSeconds;
        return s > 0 ? s * 1000 : 6000;
    }

    private async Task CloseSessionsAsync()
    {
        if (!Guid.TryParse(User.FindFirst("sub")?.Value, out var userGuid)) return;
        try
        {
            var user = await dbContext.Users.Include(x => x.Sessions).FirstOrDefaultAsync(x => x.Guid == userGuid);
            user?.CloseAllSessions();
            await dbContext.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[Logout] بستن Sessionها ناموفق بود");
        }
    }

    private async Task SignOutAsync()
    {
        var subjectId = User.GetSubjectId();
        var displayName = User.GetDisplayName();
        await HttpContext.SignOutAsync();
        HttpContext.Session.Clear();
        await events.RaiseAsync(new UserLogoutSuccessEvent(subjectId, displayName));
    }

    private IActionResult CachedFileResult(AnnouncementFileCache.CachedFile file, bool isPublic)
    {
        Response.Headers[HeaderNames.CacheControl] = $"{(isPublic ? "public" : "private")}, max-age=604800, immutable";
        Response.Headers[HeaderNames.XContentTypeOptions] = "nosniff";
        Response.Headers[HeaderNames.ContentDisposition] =
            $"inline; filename*=UTF-8''{Uri.EscapeDataString(file.FileName)}";

        return PhysicalFile(file.PhysicalPath, file.ContentType, lastModified: null,
            entityTag: new EntityTagHeaderValue(file.ETag), enableRangeProcessing: true);
    }

    private async Task<IActionResult> StreamFromUpstreamAsync(Guid guid, CancellationToken cancellationToken)
    {
        using var upstream = await announcementApiService.OpenFileAsync(guid, Request.Headers.Range.FirstOrDefault(), cancellationToken);
        if (upstream is null) return StatusCode(StatusCodes.Status502BadGateway);
        if (!upstream.IsSuccessStatusCode && upstream.StatusCode != System.Net.HttpStatusCode.PartialContent)
            return StatusCode((int)upstream.StatusCode);

        Response.StatusCode = (int)upstream.StatusCode;
        Response.ContentType = upstream.Content.Headers.ContentType?.ToString() ?? "application/octet-stream";
        if (upstream.Content.Headers.ContentLength is { } length) Response.ContentLength = length;
        if (upstream.Content.Headers.ContentRange is not null) Response.Headers[HeaderNames.ContentRange] = upstream.Content.Headers.ContentRange.ToString();
        if (upstream.Content.Headers.ContentDisposition is not null) Response.Headers[HeaderNames.ContentDisposition] = upstream.Content.Headers.ContentDisposition.ToString();
        Response.Headers[HeaderNames.AcceptRanges] = "bytes";
        Response.Headers[HeaderNames.XContentTypeOptions] = "nosniff";

        await using var stream = await upstream.Content.ReadAsStreamAsync(cancellationToken);
        await stream.CopyToAsync(Response.Body, cancellationToken);
        return new EmptyResult();
    }

    private async Task<LoginViewModel> BuildLoginViewModelAsync(string? returnUrl)
    {
        var ctx = await interaction.GetAuthorizationContextAsync(returnUrl);

        var vm = new LoginViewModel
        {
            AllowRememberLogin = AccountOptions.AllowRememberLogin,
            EnableLocalLogin = AccountOptions.AllowLocalLogin,
            ReturnUrl = returnUrl,
            Username = ctx?.LoginHint ?? string.Empty,
            CompanyName = CompanyName,
            QuickLinks = BuildQuickLinks(),
            Announcements = loginAnnouncements.Current.Items,
            SlideIntervalMs = GetSlideIntervalMs()
        };

        if (ctx?.IdP is not null && await schemeProvider.GetSchemeAsync(ctx.IdP) is not null)
        {
            var local = ctx.IdP == IdentityServerConstants.LocalIdentityProvider;
            vm.EnableLocalLogin = local;
            if (!local) vm.ExternalProviders = [new ExternalProvider { AuthenticationScheme = ctx.IdP }];
            return vm;
        }

        var schemes = await schemeProvider.GetAllSchemesAsync();
        var providers = schemes
            .Where(x => x.DisplayName is not null)
            .Select(x => new ExternalProvider { DisplayName = x.DisplayName ?? x.Name, AuthenticationScheme = x.Name })
            .ToList();

        if (ctx?.Client.ClientId is not null)
        {
            var client = await clientStore.FindEnabledClientByIdAsync(ctx.Client.ClientId);
            if (client is not null)
            {
                vm.EnableLocalLogin = client.EnableLocalLogin && AccountOptions.AllowLocalLogin;
                if (client.IdentityProviderRestrictions?.Any() == true)
                    providers = providers.Where(p => client.IdentityProviderRestrictions.Contains(p.AuthenticationScheme)).ToList();
            }
        }

        vm.ExternalProviders = providers;
        return vm;
    }

    private List<HomeQuickLinkViewModel> BuildQuickLinks()
    {
        var farzinUrl = configuration["HomeLinks:FarzinUrl"];
        var morningMeetingUrl = configuration["HomeLinks:MorningMeetingUrl"];
        var companyPolicyUrl = configuration["HomeLinks:CompanyPolicyUrl"];

        return
        [
            new()
            {
                Title = "اتوماسیون اداری فرزین", Description = "نامه‌نگاری و اتوماسیون اداری", Icon = "fa-folder-open",
                Url = farzinUrl ?? "#", AccentColor = "#3b82f6", Mode = HomeQuickLinkMode.ExternalLink,
                IsAvailable = !string.IsNullOrWhiteSpace(farzinUrl),
            },
            new()
            {
                Title = "صورتجلسه صبحگاهی", Description = "آخرین مصوبات جلسه صبحگاهی", Icon = "fa-file-signature",
                Url = morningMeetingUrl ?? "#", AccentColor = "#10b981", Mode = HomeQuickLinkMode.ExternalLink,
                IsAvailable = !string.IsNullOrWhiteSpace(morningMeetingUrl),
            },
            new()
            {
                Title = "سیستم‌های مدیریتی", Description = "مستندات و رویه‌های سیستم‌های مدیریتی", Icon = "fa-sitemap",
                Url = Url.Action("ManagementSystems", "Home") ?? "#", AccentColor = "#8b5cf6", Mode = HomeQuickLinkMode.InternalPage,
                IsAvailable = true,
            },
            new()
            {
                Title = "خط‌مشی شرکت", Description = "اهداف، ماموریت و خط‌مشی سازمان", Icon = "fa-flag",
                Url = companyPolicyUrl ?? "#", AccentColor = "#f97316", Mode = HomeQuickLinkMode.ExternalLink,
                IsAvailable = !string.IsNullOrWhiteSpace(companyPolicyUrl),
            },
        ];
    }
}
