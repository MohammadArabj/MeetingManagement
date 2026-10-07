using System.Globalization;
using System.Security.Claims;
using System.Text.Json;
using Epc.Application.Setting;
using EPC.SSO.Facades;
using EPC.SSO.Infrastructure;
using EPC.SSO.Services;
using EPC.SSO.SettingModels;
using IdentityServer8;
using IdentityServer8.Events;
using IdentityServer8.Extensions;
using IdentityServer8.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Net.Http.Headers;
using UserManagement.Domain.PermissionAgg.Services;
using UserManagement.Infrastructure.Query.Contract.UserPortal;

namespace EPC.SSO.Quickstart.Grants;

/// <summary>
/// داشبورد پورتال.
///
/// اصلاحات:
///  • همه‌ی کش‌ها از IAppCache (ضد Stampede + بازگشت به داده‌ی قبلی هنگام خطا).
///  • خطای API دیگر به‌صورت «لیست خالی» برای چند دقیقه کش نمی‌شود.
///  • 🔴 جزئیات اطلاعیه از endpoint اختصاصی کاربر (GetForUser) خوانده می‌شود، نه GetForEdit.
///  • 🔴 IP کاربر از Connection.RemoteIpAddress (که ForwardedHeaders فقط برای پراکسی‌های مورد اعتماد
///    اصلاحش می‌کند) — قبلاً X-Forwarded-For بدون بررسی پذیرفته می‌شد و محدودیت IP قابل جعل بود.
///  • 🔴 ChangePosition محافظ AntiForgery دارد.
///  • فایل‌های داشبورد از کش دیسکی محلی سرو می‌شوند.
/// </summary>
[SecurityHeaders]
[Authorize]
public class GrantsController(
    IIdentityServerInteractionService interaction,
    IEventService events,
    IConfiguration configuration,
    WindowsProgramService windowsProgramService,
    IUserPortalQueryFacade userPortalQueryFacade,
    AnnouncementApiService announcementApiService,
    AnnouncementFileCache fileCache,
    OtherProgramService otherProgramService,
    DashboardDataService dashboardData,
    IAppCache cache,
    IIpAccessRestrictionService ipAccessRestrictionService,
    ExternalApiClientService externalApiClient,
    ILogger<GrantsController> logger)
    : Controller
{
    private const string UserProfilePermissionCode = "SSO.ViewUserProfile";

    // ════════════════════════════════════════════════════════════════════════
    //  INDEX
    // ════════════════════════════════════════════════════════════════════════
    public async Task<IActionResult> Index()
    {
        var model = await BuildViewModelAsync();

        ViewData["PositionsJson"] = JsonSerializer.Serialize(
            model.Positions.Select(p => new { guid = p.Guid, title = p.Title, isDelegated = p.IsDelegated }));
        ViewData["SelectedPositionGuid"] = model.SelectedPositionGuid?.ToString() ?? string.Empty;
        ViewData["CanViewUserProfiles"] = await CanViewUserProfilesAsync();

        return View("Index", model);
    }

    private async Task<GrantsViewModel> BuildViewModelAsync()
    {
        var userGuid = CurrentUserGuid;
        var positionGuid = SelectedPositionFromClaim;
        var isSuperAdmin = IsSuperAdmin;

        var portal = await dashboardData.GetPortalAsync(userGuid, positionGuid, isSuperAdmin, HttpContext.RequestAborted);

        return new GrantsViewModel
        {
            Grants = (portal?.Systems ?? []).Select(s => new GrantViewModel
            {
                ClientId = s.Guid.ToString(),
                ClientName = s.Title,
                ClientLogoUrl = LogoUrl(s.Guid, s.Image),
                ClientUrl = s.Url ?? string.Empty,
                Description = s.Description ?? string.Empty
            }).ToList(),
            Positions = (portal?.Positions ?? []).Select(p => new PositionModel
            {
                Guid = p.Guid,
                Title = p.Title,
                IsDelegated = p.IsDelegated,
                DelegationId = p.DelegationId
            }).ToList(),
            SelectedPositionGuid = portal?.EffectivePositionGuid ?? positionGuid,
            PersonnelCode = User.FindFirst("PersonnelCode")?.Value ?? "0"
        };
    }

    // ════════════════════════════════════════════════════════════════════════
    //  ویجت‌های داشبورد (AJAX)
    // ════════════════════════════════════════════════════════════════════════
    // هر ویجت endpoint مستقل دارد تا صفحه هر بخش را به محض آماده شدن نمایش دهد (نه پس از کندترین API).
    // پاسخ‌ها خطا را با «null» (و نه لیست خالی) اعلام می‌کنند تا ویجت پیام «تلاش دوباره» نشان دهد.

    [HttpGet]
    public async Task<IActionResult> GetAnnouncements()
        => Json(await Safe(() => dashboardData.GetAnnouncementsAsync(CurrentUserGuid, HttpContext.RequestAborted)));

    [HttpGet]
    public async Task<IActionResult> GetSurveys()
        => Json(await Safe(() => dashboardData.GetSurveysAsync(CurrentUserGuid, HttpContext.RequestAborted)));

    [HttpGet]
    public async Task<IActionResult> GetMeetings()
    {
        var positionGuid = await GetSelectedPositionGuidAsync();
        return Json(await Safe(() => dashboardData.GetMeetingsAsync(CurrentUserGuid, positionGuid, HttpContext.RequestAborted)));
    }

    [HttpGet]
    public async Task<IActionResult> GetSuggestions()
        => Json(await Safe(async () => (List<EPC.SSO.Services.TopSuggesterDto>?)await dashboardData.GetSuggestionsAsync()));

    [HttpGet]
    public async Task<IActionResult> GetWindowsApps()
        => Json(await Safe(async () => (List<WindowsAppViewModel>?)await dashboardData.GetWindowsAppsAsync(User.FindFirst("PersonnelCode")?.Value)));

    [HttpGet]
    public async Task<IActionResult> GetOtherPrograms()
        => Json(await Safe(async () => (List<OtherProgramViewModel>?)await dashboardData.GetOtherProgramsAsync()));

    /// <summary>
    /// همه‌ی ویجت‌ها در یک درخواست و به‌صورت موازی (هر بخش مستقل؛ خطای یکی بقیه را خراب نمی‌کند).
    /// صفحه‌ی جدید داشبورد از این endpoint استفاده می‌کند.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetDashboardData()
    {
        var userGuid = CurrentUserGuid;
        var ct = HttpContext.RequestAborted;
        var personnelCode = User.FindFirst("PersonnelCode")?.Value;
        var positionGuid = await GetSelectedPositionGuidAsync();

        var announcementsTask = Safe(() => dashboardData.GetAnnouncementsAsync(userGuid, ct));
        var surveysTask = Safe(() => dashboardData.GetSurveysAsync(userGuid, ct));
        var meetingsTask = Safe(() => dashboardData.GetMeetingsAsync(userGuid, positionGuid, ct));
        var winAppsTask = Safe(async () => (List<WindowsAppViewModel>?)await dashboardData.GetWindowsAppsAsync(personnelCode));
        var otherTask = Safe(async () => (List<OtherProgramViewModel>?)await dashboardData.GetOtherProgramsAsync());
        var suggestionsTask = Safe(async () => (List<EPC.SSO.Services.TopSuggesterDto>?)await dashboardData.GetSuggestionsAsync());

        await Task.WhenAll(announcementsTask, surveysTask, meetingsTask, winAppsTask, otherTask, suggestionsTask);

        return Json(new
        {
            announcements = await announcementsTask,
            surveys = await surveysTask,
            meetings = await meetingsTask,
            windowsApps = await winAppsTask,
            otherPrograms = await otherTask,
            suggestions = await suggestionsTask
        });
    }

    /// <summary>
    /// عیب‌یابی اتصال SSO به APIها (فقط سوپرادمین): /Grants/Diagnostics
    /// برای هر API نشان می‌دهد توکن گرفته شد یا نه، Issuer توکن چیست، کد پاسخ، زمان و متن خطا.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Diagnostics()
    {
        if (!IsSuperAdmin) return Forbid();

        var userGuid = CurrentUserGuid;
        var positionGuid = await GetSelectedPositionGuidAsync();
        var ct = HttpContext.RequestAborted;
        ExternalApiConfiguration Cfg(string name) => configuration.GetSection($"ExternalApis:{name}").Get<ExternalApiConfiguration>() ?? new();

        var probes = await Task.WhenAll(
            externalApiClient.ProbeAsync("AnnouncementApi", Cfg("AnnouncementApi"), HttpMethod.Post, "/api/Announcement/GetForDashboard", new { UserGuid = userGuid, Count = 5 }, ct),
            externalApiClient.ProbeAsync("MeetingApi", Cfg("MeetingApi"), HttpMethod.Get, $"/api/Meeting/GetFutureMeetings?userGuid={userGuid}&positionGuid={positionGuid}", null, ct),
            externalApiClient.ProbeAsync("SurveyApi", Cfg("SurveyApi"), HttpMethod.Get, $"/api/Survey/GetActiveSurveys?userGuid={userGuid}", null, ct),
            externalApiClient.ProbeAsync("FileManagementApi", Cfg("FileManagementApi"), HttpMethod.Post, "/api/Attachment/GetMetas", Array.Empty<Guid>(), ct));

        return Json(new
        {
            identityServer = new
            {
                authority = configuration["IdentityServer:Authority"],
                issuerUri = configuration["IdentityServer:IssuerUri"],
                internalAuthority = configuration["IdentityServer:InternalAuthority"]
            },
            probes
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    //  اطلاعیه‌ها
    // ════════════════════════════════════════════════════════════════════════
    [HttpGet]
    public async Task<IActionResult> GetAnnouncementDetail(Guid guid)
    {
        var userGuid = CurrentUserGuid;
        var detail = await announcementApiService.GetDetailForUserAsync(guid, userGuid, HttpContext.RequestAborted);
        if (detail is null)
            return Json(new { success = false, message = "اطلاعیه یافت نشد." });

        var files = await ResolveFilesAsync(detail.Files);

        // ثبت خودکار خواندن فقط یک‌بار (قبلاً IsRead همیشه false بود و هر بار ثبت می‌شد)
        if (!detail.RequireReadConfirmation && !detail.IsRead)
        {
            if (await announcementApiService.ConfirmReadAsync(guid, userGuid, ClientIp, HttpContext.RequestAborted))
            {
                cache.Remove(DashboardDataService.AnnouncementsKey(userGuid));
                detail.IsRead = true;
            }
        }

        return Json(new
        {
            success = true,
            data = new
            {
                detail.Guid,
                detail.Title,
                detail.Body,
                detail.Type,
                detail.TypeLabel,
                detail.Date,
                detail.Priority,
                detail.PriorityLabel,
                detail.RequireReadConfirmation,
                detail.IsRead,
                Files = files
            }
        });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ConfirmAnnouncementRead([FromBody] ConfirmAnnouncementReadModel model)
    {
        var userGuid = CurrentUserGuid;
        var ok = await announcementApiService.ConfirmReadAsync(model.AnnouncementGuid, userGuid, ClientIp, HttpContext.RequestAborted);
        cache.Remove(DashboardDataService.AnnouncementsKey(userGuid));
        return ok ? Json(new { success = true }) : StatusCode(StatusCodes.Status502BadGateway, new { success = false });
    }

    [HttpGet]
    public IActionResult AnnouncementArchive() => View();

    [HttpGet]
    public async Task<IActionResult> GetAnnouncementsArchive(int page = 1, int pageSize = 10, string? title = null, string? fromDate = null, string? toDate = null)
    {
        if (page < 1) page = 1;
        if (pageSize is < 1 or > 50) pageSize = 10;

        DateTime? from = null, to = null;
        var pc = new PersianCalendar();
        if (TryParseJalaliDate(fromDate, pc, out var f)) from = f;
        if (TryParseJalaliDate(toDate, pc, out var t)) to = t.Date.AddDays(1).AddTicks(-1);
        if (from > to) (from, to) = (to, from);

        var result = await announcementApiService.GetDashboardAnnouncementsArchiveAsync(
            CurrentUserGuid, page, pageSize, title?.Trim(), from, to, HttpContext.RequestAborted);

        return Json(result ?? new AnnouncementDashboardPagedDto { Page = page, PageSize = pageSize });
    }

    [HttpGet]
    public async Task<IActionResult> FileProxy(Guid guid, CancellationToken cancellationToken)
    {
        if (guid == Guid.Empty) return NotFound();

        var userGuid = CurrentUserGuid;
        // فقط فایل‌های اطلاعیه‌ای که همین کاربر جزئیاتش را دیده است
        var allowed = cache.TryGet<HashSet<Guid>>(UserAllowedFilesKey(userGuid), out var set) && set!.Contains(guid);
        if (!allowed) return Forbid();

        if (!fileCache.TryGet(guid, out var cached))
        {
            var meta = cache.TryGet<FileMeta>($"filemeta:{guid:N}", out var m) ? m : null;
            if (meta is not null)
                cached = await fileCache.GetOrDownloadAsync(guid, meta, cancellationToken);
        }

        if (cached is not null)
        {
            Response.Headers[HeaderNames.CacheControl] = "private, max-age=604800, immutable";
            Response.Headers[HeaderNames.XContentTypeOptions] = "nosniff";
            Response.Headers[HeaderNames.ContentDisposition] = $"inline; filename*=UTF-8''{Uri.EscapeDataString(cached.FileName)}";
            return PhysicalFile(cached.PhysicalPath, cached.ContentType, null, new EntityTagHeaderValue(cached.ETag), enableRangeProcessing: true);
        }

        using var upstream = await announcementApiService.OpenFileAsync(guid, Request.Headers.Range.FirstOrDefault(), cancellationToken);
        if (upstream is null) return StatusCode(StatusCodes.Status502BadGateway);
        if (!upstream.IsSuccessStatusCode) return StatusCode((int)upstream.StatusCode);

        Response.StatusCode = (int)upstream.StatusCode;
        Response.ContentType = upstream.Content.Headers.ContentType?.ToString() ?? "application/octet-stream";
        if (upstream.Content.Headers.ContentLength is { } len) Response.ContentLength = len;
        if (upstream.Content.Headers.ContentRange is not null) Response.Headers[HeaderNames.ContentRange] = upstream.Content.Headers.ContentRange.ToString();
        if (upstream.Content.Headers.ContentDisposition is not null) Response.Headers[HeaderNames.ContentDisposition] = upstream.Content.Headers.ContentDisposition.ToString();
        Response.Headers[HeaderNames.XContentTypeOptions] = "nosniff";

        await using var stream = await upstream.Content.ReadAsStreamAsync(cancellationToken);
        await stream.CopyToAsync(Response.Body, cancellationToken);
        return new EmptyResult();
    }

    [HttpGet]
    public async Task<IActionResult> SystemLogo(Guid id, string? v)
    {
        if (!cache.TryGet<LogoEntry>($"syslogo:{id:N}", out var logo) || logo is null)
        {
            await BuildViewModelAsync(); // کش منقضی شده: داشبورد همین کاربر دوباره لوگوها را ثبت می‌کند
            if (!cache.TryGet($"syslogo:{id:N}", out logo) || logo is null) return NotFound();
        }

        var comma = logo.DataUri.IndexOf(',');
        var header = comma > 5 ? logo.DataUri[5..comma] : string.Empty; // image/png;base64
        var contentType = header.Split(';')[0];
        if (comma < 0 || !header.Contains("base64", StringComparison.OrdinalIgnoreCase)
            || !contentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase) || contentType.Contains("svg", StringComparison.OrdinalIgnoreCase))
            return NotFound();

        byte[] bytes;
        try { bytes = Convert.FromBase64String(logo.DataUri[(comma + 1)..]); }
        catch (FormatException) { return NotFound(); }

        Response.Headers[HeaderNames.CacheControl] = v == logo.Version ? "private, max-age=2592000, immutable" : "private, max-age=300";
        Response.Headers[HeaderNames.XContentTypeOptions] = "nosniff";
        return File(bytes, contentType, null, new EntityTagHeaderValue($"\"{logo.Version}\""));
    }

    [HttpGet]
    public async Task<IActionResult> AppIcon(int id)
    {
        var (bytes, contentType) = await windowsProgramService.GetIconAsync(id);
        if (bytes is null || bytes.Length == 0) return NotFound();

        Response.Headers[HeaderNames.CacheControl] = "private, max-age=86400";
        return File(bytes, contentType);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  سمت، سوابق ورود، پروفایل کاربران
    // ════════════════════════════════════════════════════════════════════════
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ChangePosition([FromBody] SelectPositionModel model)
    {
        var selection = await userPortalQueryFacade.GetPositionSelection(new PortalPositionSelectionSearchModel
        {
            UserGuid = CurrentUserGuid,
            PositionGuid = model.PositionGuid
        });

        if (!selection.IsAllowed)
            return Json(new { success = false, message = "این سمت برای کاربر جاری مجاز نیست." });

        if (User.Identity is not ClaimsIdentity identity)
            return Json(new { success = false, message = "نشست کاربر نامعتبر است." });

        foreach (var type in new[] { "ActivatedPosition", "IsDelegate", "DelegationId" })
        {
            var existing = identity.FindFirst(type);
            if (existing is not null) identity.RemoveClaim(existing);
        }

        identity.AddClaim(new Claim("ActivatedPosition", model.PositionGuid.ToString()));
        identity.AddClaim(new Claim("IsDelegate", selection.IsDelegated.ToString().ToLowerInvariant()));
        identity.AddClaim(new Claim("DelegationId", selection.DelegationId?.ToString() ?? string.Empty));

        await HttpContext.SignInAsync(new ClaimsPrincipal(identity));
        return Json(new { success = true, message = "سمت با موفقیت تغییر یافت" });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Revoke(string clientId)
    {
        await interaction.RevokeUserConsentAsync(clientId);
        await events.RaiseAsync(new GrantsRevokedEvent(User.GetSubjectId(), clientId));
        return RedirectToAction("Index");
    }

    [HttpGet]
    public async Task<IActionResult> GetSessions(string? fromDate = null, string? toDate = null)
    {
        var pc = new PersianCalendar();
        var from = TryParseJalaliDate(fromDate, pc, out var f) ? f : DateTime.Now.Date.AddMonths(-1);
        var to = TryParseJalaliDate(toDate, pc, out var t) ? t.Date.AddDays(1).AddTicks(-1) : DateTime.Now;
        if (from > to) (from, to) = (to, from);

        var sessions = await userPortalQueryFacade.GetSessions(new PortalUserSessionSearchModel
        {
            UserGuid = CurrentUserGuid,
            FromDate = from,
            ToDate = to,
            Take = 500
        });

        return Json(new { items = sessions, fromDate = ToJalali(from), toDate = ToJalali(to) });
    }

    [HttpGet]
    public async Task<IActionResult> GetUsersForProfile(string? search = null, int page = 1, int pageSize = 20)
    {
        if (!await CanViewUserProfilesAsync()) return Forbid();

        var result = await userPortalQueryFacade.SearchProfiles(new PortalProfileUserSearchModel
        {
            Search = search?.Trim(),
            Page = page,
            PageSize = pageSize
        });

        return Json(new
        {
            items = result.Items.Select(x => new
            {
                guid = x.Guid,
                fullName = x.FullName,
                personnelCode = x.PersonnelCode,
                mainPosition = x.MainPosition,
                isSuperAdmin = x.IsSuperAdmin
            }),
            result.Total,
            result.Page,
            result.PageSize,
            result.HasMore
        });
    }
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> LaunchOtherProgram([FromBody] LaunchOtherProgramModel model)
    {
        var personnelCode = User.FindFirst("PersonnelCode")?.Value;
        if (string.IsNullOrWhiteSpace(personnelCode))
            return Json(new { success = false, message = "کد پرسنلی در نشست شما یافت نشد." });

        var r = await otherProgramService.PrepareLaunchAsync(model.Id, personnelCode, HttpContext.RequestAborted);
        if (!r.Success) return Json(new { success = false, message = r.Message });

        logger.LogInformation("[OtherProgram] {Code} برنامه {Id} را اجرا کرد ({Type})", personnelCode, model.Id, r.Type);
        return Json(new { success = true, type = r.Type, url = r.Url });
    }

    public class LaunchOtherProgramModel { public int Id { get; set; } }
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ImpersonateUser([FromBody] ImpersonateUserModel model)
    {
        if (!await CanViewUserProfilesAsync()) return Forbid();
        if (model.UserGuid == Guid.Empty)
            return Json(new { success = false, message = "کاربر نامعتبر است." });
        if (User.FindFirst("ImpersonatedBy") is not null)
            return Json(new { success = false, message = "ابتدا از حالت ورود به‌جای کاربر دیگر خارج شوید." });

        var adminGuid = CurrentUserGuid;
        if (model.UserGuid == adminGuid)
            return Json(new { success = false, message = "نمی‌توانید به‌جای خودتان وارد شوید." });

        var target = await userPortalQueryFacade.GetIdentityUser(model.UserGuid);
        if (target is null)
            return Json(new { success = false, message = "کاربر یافت نشد." });
        if (target.IsSuperAdmin && !IsSuperAdmin)
            return Json(new { success = false, message = "امکان ورود به‌جای این کاربر وجود ندارد." });

        logger.LogWarning("[Impersonation] {Admin} وارد حساب {Target} شد (IP: {Ip})", adminGuid, model.UserGuid, ClientIp);
        await SignInPortalIdentityAsync(target, adminGuid, User.FindFirst("PersonnelCode")?.Value ?? string.Empty);

        return Json(new { success = true, redirectUrl = Url.Action("Index", "Grants") });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> EndImpersonation()
    {
        if (!Guid.TryParse(User.FindFirst("ImpersonatedBy")?.Value, out var adminGuid))
            return RedirectToAction("Index");

        var admin = await userPortalQueryFacade.GetIdentityUser(adminGuid);
        if (admin is null)
        {
            await HttpContext.SignOutAsync();
            return RedirectToAction("Login", "Account");
        }

        await SignInPortalIdentityAsync(admin);
        return RedirectToAction("Index");
    }

    // ════════════════════════════════════════════════════════════════════════
    //  Private
    // ════════════════════════════════════════════════════════════════════════
    private Guid CurrentUserGuid => Guid.TryParse(User.FindFirst("sub")?.Value, out var g) ? g : Guid.Empty;

    private Guid SelectedPositionFromClaim => Guid.TryParse(User.FindFirst("ActivatedPosition")?.Value, out var g) ? g : Guid.Empty;

    private bool IsSuperAdmin => bool.TryParse(User.FindFirst("IsSuperAdmin")?.Value, out var v) && v;

    private string ClientIp
    {
        get
        {
            var ip = HttpContext.Connection.RemoteIpAddress;
            if (ip is { IsIPv4MappedToIPv6: true }) ip = ip.MapToIPv4();
            return ip?.ToString() ?? string.Empty;
        }
    }

    private static string UserAllowedFilesKey(Guid userGuid) => $"ann-allowed-files:{userGuid:N}";

    private async Task<List<object>> ResolveFilesAsync(List<AnnouncementFileDto> files)
    {
        var guids = files.Where(f => f.FileGuid != Guid.Empty).Select(f => f.FileGuid).Distinct().ToList();
        if (guids.Count == 0) return [];

        var userGuid = CurrentUserGuid;
        // کپی جدید (نه تغییر نمونه‌ی کش‌شده) تا درخواست‌های هم‌زمان یک کاربر تداخل نداشته باشند
        cache.TryGet<HashSet<Guid>>(UserAllowedFilesKey(userGuid), out var existing);
        var allowed = existing is null ? new HashSet<Guid>() : new HashSet<Guid>(existing);
        foreach (var g in guids) allowed.Add(g);
        cache.Set(UserAllowedFilesKey(userGuid), allowed, TimeSpan.FromMinutes(30));

        var metas = new Dictionary<Guid, FileMeta>();
        var misses = new List<Guid>();
        foreach (var g in guids)
        {
            if (cache.TryGet<FileMeta>($"filemeta:{g:N}", out var m) && m is not null) metas[g] = m;
            else misses.Add(g);
        }

        if (misses.Count > 0)
        {
            var fetched = await announcementApiService.GetFileMetasAsync(misses, HttpContext.RequestAborted) ?? [];
            foreach (var m in fetched)
            {
                metas[m.Guid] = m;
                cache.Set($"filemeta:{m.Guid:N}", m, TimeSpan.FromHours(6));
            }
        }

        return files
            .Where(f => metas.ContainsKey(f.FileGuid))
            .Select(f =>
            {
                var m = metas[f.FileGuid];
                var vm = new AnnouncementFileViewModel
                {
                    FileGuid = f.FileGuid,
                    FileType = f.FileType,
                    FileName = m.FileName,
                    OriginalFileName = m.OriginalFileName,
                    ContentType = m.ContentType,
                    FileSize = m.FileSize,
                    FileUrl = $"/Grants/FileProxy?guid={f.FileGuid}"
                };
                return (object)new
                {
                    vm.FileGuid, vm.FileType, vm.DisplayName, vm.ContentType, vm.FileSize, vm.FileUrl, vm.IsImage, vm.IsPdf
                };
            })
            .ToList();
    }

    private async Task<Guid> GetSelectedPositionGuidAsync()
    {
        var selected = SelectedPositionFromClaim;
        if (selected != Guid.Empty) return selected;
        var model = await BuildViewModelAsync();
        return model.SelectedPositionGuid ?? Guid.Empty;
    }

    private async Task<bool> CanViewUserProfilesAsync()
    {
        var hasPermission = IsSuperAdmin || User.FindAll("Permissions")
            .SelectMany(c => c.Value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            .Contains(UserProfilePermissionCode, StringComparer.OrdinalIgnoreCase);
        if (hasPermission) return true;

        // قبلاً در هر بار باز شدن داشبورد یک Query به پایگاه داده‌ی UserManagement می‌زد
        var ip = ClientIp;
        var allowed = await cache.GetOrCreateAsync($"ipallow:{UserProfilePermissionCode}:{ip}",
            async _ => new BoolBox(await ipAccessRestrictionService.IsAllowedAsync(UserProfilePermissionCode, ip)),
            TimeSpan.FromMinutes(5), TimeSpan.Zero, HttpContext.RequestAborted);
        return allowed?.Value ?? false;
    }

    private sealed record BoolBox(bool Value);

    /// <summary>
    /// لوگوی سامانه. تصویر Base64 داخل HTML هر بار باز شدن داشبورد دوباره ارسال می‌شد (صفحه‌ی سنگین و غیرقابل کش)؛
    /// حالا با آدرس جدا و نسخه‌دار سرو می‌شود و مرورگر آن را کش می‌کند.
    /// </summary>
    private string? LogoUrl(Guid systemGuid, string? image)
    {
        if (string.IsNullOrWhiteSpace(image) || !image.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
            return image;

        var version = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(image)))[..12];
        cache.Set($"syslogo:{systemGuid:N}", new LogoEntry(image, version), TimeSpan.FromHours(24));
        return Url.Action(nameof(SystemLogo), new { id = systemGuid, v = version });
    }

    private sealed record LogoEntry(string DataUri, string Version);

    private async Task SignInPortalIdentityAsync(PortalIdentityUserViewModel user, Guid? impersonatedBy = null, string? impersonatedByPersonnelCode = null)
    {
        var claims = new List<Claim>
        {
            new("ActivatedPosition", user.ActivatedPositionGuid.ToString()),
            new("IsDelegate", "false"),
            new("DelegationId", string.Empty),
            new("FLName", user.FullName),
            new("PersonnelCode", user.PersonnelCode),
            new("PasswordExpired", user.PasswordExpired.ToString()),
            new("IsSuperAdmin", user.IsSuperAdmin.ToString())
        };

        claims.AddRange(user.Permissions.Select(p => new Claim("Permissions", p)));

        if (impersonatedBy.HasValue)
        {
            claims.Add(new Claim("ImpersonatedBy", impersonatedBy.Value.ToString()));
            claims.Add(new Claim("ImpersonatedByPersonnelCode", impersonatedByPersonnelCode ?? string.Empty));
        }

        await HttpContext.SignInAsync(new IdentityServerUser(user.Guid.ToString())
        {
            DisplayName = user.PersonnelCode,
            AdditionalClaims = claims
        }, null);
    }

    private async Task<T?> Safe<T>(Func<Task<T?>> action) where T : class
    {
        try { return await action(); }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[Dashboard] یک بخش داشبورد خطا داد");
            return null;
        }
    }

    private static string ToJalali(DateTime dt)
    {
        var pc = new PersianCalendar();
        return $"{pc.GetYear(dt):0000}/{pc.GetMonth(dt):00}/{pc.GetDayOfMonth(dt):00}";
    }

    private static bool TryParseJalaliDate(string? value, PersianCalendar pc, out DateTime result)
    {
        result = default;
        if (string.IsNullOrWhiteSpace(value)) return false;
        var parts = value.Split('/', '-');
        if (parts.Length != 3 ||
            !int.TryParse(parts[0], out var y) || !int.TryParse(parts[1], out var m) || !int.TryParse(parts[2], out var d))
            return false;
        try { result = pc.ToDateTime(y, m, d, 0, 0, 0, 0); return true; }
        catch { return false; }
    }
}

public class SelectPositionModel
{
    public Guid PositionGuid { get; set; }
}
