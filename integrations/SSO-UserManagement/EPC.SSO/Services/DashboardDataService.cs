using EPC.SSO.Facades;
using EPC.SSO.Infrastructure;
using EPC.SSO.Quickstart.Grants;
using EPC.SSO.SettingModels;
using Epc.Application.Setting;
using UserManagement.Infrastructure.Query.Contract.UserPortal;

namespace EPC.SSO.Services;

/// <summary>
/// داده‌های ویجت‌های داشبورد با کلید کش یکسان برای کنترلر و پیش‌بارگذاری هنگام ورود.
/// همه از IAppCache (single-flight + stale-while-revalidate) می‌گذرند؛ هر ویجت مستقل است و خطای یکی
/// بقیه را خراب نمی‌کند.
/// </summary>
public sealed class DashboardDataService(
    IAppCache cache,
    IServiceScopeFactory scopeFactory,
    ISettingService settingService,
    SurveyApiService surveyApiService,
    MeetingApiService meetingApiService,
    AnnouncementApiService announcementApiService,
    WindowsProgramService windowsProgramService,
    OtherProgramService otherProgramService,
    SuggestionService suggestionService,
    EPC.SSO.Realtime.PortalCacheVersions cacheVersions)
{
    /// <summary>پس از تازگی، داده تا این مدت به‌عنوان پشتیبان (و پاسخ فوری) نگه داشته می‌شود</summary>
    private static readonly TimeSpan StaleWindow = TimeSpan.FromHours(4);

    public static string AnnouncementsKey(Guid userGuid) => $"announcements:{userGuid:N}";

    public Task<PortalDashboardViewModel?> GetPortalAsync(Guid userGuid, Guid positionGuid, bool isSuperAdmin, CancellationToken ct = default)
        => cache.GetOrCreateAsync(
            $"portal:dashboard:{userGuid:N}:{positionGuid:N}",
            async _ =>
            {
                // ممکن است پس از پایان درخواست (در پس‌زمینه) اجرا شود؛ Scope و DbContext خودش را دارد
                await using var scope = scopeFactory.CreateAsyncScope();
                return await scope.ServiceProvider.GetRequiredService<IUserPortalQueryFacade>()
                    .GetDashboard(new PortalDashboardSearchModel
                    {
                        UserGuid = userGuid,
                        SelectedPositionGuid = positionGuid,
                        IsSuperAdmin = isSuperAdmin
                    });
            },
            TimeSpan.FromMinutes(2), TimeSpan.FromHours(8), ct);

    public Task<List<AnnouncementDashboardDto>?> GetAnnouncementsAsync(Guid userGuid, CancellationToken ct = default)
    {
        var count = settingService.Fetch<AnnouncementSettingViewModel>().DashboardAnnouncementCount;
        if (count <= 0) count = 5;
        return cache.GetOrCreateAsync(AnnouncementsKey(userGuid),
            c => announcementApiService.GetDashboardAnnouncementsAsync(userGuid, count, c),
            TimeSpan.FromMinutes(2), StaleWindow, ct);
    }

    public Task<List<MySurveyItemViewModel>?> GetSurveysAsync(Guid userGuid, CancellationToken ct = default)
        => cache.GetOrCreateAsync($"surveys:{userGuid:N}",
            c => surveyApiService.GetMySurveysAsync(userGuid, c),
            TimeSpan.FromMinutes(3), StaleWindow, ct);

    public Task<List<MeetingFutureDto>?> GetMeetingsAsync(Guid userGuid, Guid positionGuid, CancellationToken ct = default)
        => cache.GetOrCreateAsync($"meetings:{userGuid:N}:{positionGuid:N}:{cacheVersions.Of(userGuid)}",
            c => meetingApiService.GetMyMeetingsAsync(userGuid, positionGuid, c),
            TimeSpan.FromMinutes(3), StaleWindow, ct);

    public async Task<List<WindowsAppViewModel>> GetWindowsAppsAsync(string? personnelCode)
        => string.IsNullOrWhiteSpace(personnelCode) ? [] : await windowsProgramService.GetAccessibleAppsAsync(personnelCode);

    public Task<List<OtherProgramViewModel>> GetOtherProgramsAsync() => otherProgramService.GetAllAsync();

    public Task<List<TopSuggesterDto>> GetSuggestionsAsync() => suggestionService.GetTopSuggestionsAsync(5);
}

/// <summary>
/// پیش‌بارگذاری داشبورد بلافاصله پس از ورود موفق (در پس‌زمینه)؛ تا کاربر به داشبورد برسد
/// داده‌ها معمولاً در کش آماده‌اند و صفحه بدون انتظار برای APIها نمایش داده می‌شود.
/// </summary>
public sealed class DashboardPrefetcher(IServiceScopeFactory scopeFactory, ILogger<DashboardPrefetcher> logger)
{
    public void Prefetch(Guid userGuid, Guid positionGuid, bool isSuperAdmin, string? personnelCode)
    {
        if (userGuid == Guid.Empty) return;

        _ = Task.Run(async () =>
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var data = scope.ServiceProvider.GetRequiredService<DashboardDataService>();

                var portal = await data.GetPortalAsync(userGuid, positionGuid, isSuperAdmin);
                var effectivePosition = portal?.EffectivePositionGuid ?? positionGuid;

                await Task.WhenAll(
                    data.GetAnnouncementsAsync(userGuid),
                    data.GetSurveysAsync(userGuid),
                    data.GetMeetingsAsync(userGuid, effectivePosition),
                    data.GetWindowsAppsAsync(personnelCode),
                    data.GetOtherProgramsAsync(),
                    data.GetSuggestionsAsync());
            }
            catch (Exception ex)
            {
                logger.LogDebug(ex, "[Prefetch] پیش‌بارگذاری داشبورد برای {User} کامل نشد", userGuid);
            }
        });
    }
}
