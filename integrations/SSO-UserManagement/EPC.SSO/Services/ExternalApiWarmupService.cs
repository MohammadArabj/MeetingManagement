using Microsoft.Data.SqlClient;
using System.Diagnostics;
using System.Text;

namespace EPC.SSO.Services;

/// <summary>
/// گرم نگه داشتن اتصال‌ها و توکن‌ها.
///
/// تغییرات نسبت به نسخه‌ی قبلی:
///  • BackgroundService با PeriodicTimer → اجرای هم‌پوشان (Overlap) ممکن نیست.
///  • فاصله ۳ دقیقه (SqlClient اتصال‌های بیکار را بعد از ۴ تا ۸ دقیقه می‌بندد؛ ۱۰ دقیقه بی‌اثر بود).
///  • توصیه‌ی اصلی همچنان: «Min Pool Size=5» در Connection String + تنظیمات IIS (deploy/iis-setup.ps1).
/// </summary>
public sealed class ExternalApiWarmupService(
    S2STokenProvider tokenProvider,
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration,
    ILogger<ExternalApiWarmupService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(3);

    private static readonly string[] ApiSections =
    [
        "ExternalApis:AnnouncementApi",
        "ExternalApis:SurveyApi",
        "ExternalApis:MeetingApi",
        "ExternalApis:FileManagementApi",
        "ExternalApis:PhoneDirectoryApi",
    ];

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await WarmUpAllAsync(stoppingToken);

        using var timer = new PeriodicTimer(Interval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
            await WarmUpAllAsync(stoppingToken);
    }

    private async Task WarmUpAllAsync(CancellationToken ct)
    {
        try
        {
            await Task.WhenAll(
                PingSqlAsync("PortalDB", configuration.GetConnectionString("Portal"), ct),
                PingSqlAsync("ApplicationDB", DecodeIfNeeded(configuration.GetConnectionString("Application")), ct),
                PingSqlAsync("SuggestionDB", configuration.GetConnectionString("SuggestionSystem"), ct),
                WarmUpTokensAsync(ct),
                WarmUpSharedDashboardDataAsync());
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[Warmup] خطای غیرمنتظره");
        }
    }

    /// <summary>
    /// داده‌های مشترک همه‌ی کاربران (برترین پیشنهاددهندگان با Query سنگین، سایر برنامه‌ها) پیش از اولین
    /// کاربر بارگذاری و مرتب تازه می‌شوند؛ هیچ کاربری منتظر این Queryها نمی‌ماند.
    /// </summary>
    private async Task WarmUpSharedDashboardDataAsync()
    {
        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var data = scope.ServiceProvider.GetRequiredService<DashboardDataService>();
            // دفترچه‌ی تلفن هم پیش از اولین کاربر و هر ۳ دقیقه تازه می‌شود (جستجو همیشه از حافظه)
            var phoneDirectory = scope.ServiceProvider.GetRequiredService<PhoneDirectoryApiService>();
            await Task.WhenAll(data.GetSuggestionsAsync(), data.GetOtherProgramsAsync(), phoneDirectory.GetAllAsync());
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[Warmup] بارگذاری داده‌های مشترک داشبورد ناموفق بود");
        }
    }

    private async Task PingSqlAsync(string name, string? connectionString, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(connectionString)) return;

        var sw = Stopwatch.StartNew();
        try
        {
            await using var conn = new SqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new SqlCommand("SELECT 1", conn) { CommandTimeout = 5 };
            await cmd.ExecuteScalarAsync(ct);

            if (sw.ElapsedMilliseconds > 1000)
                logger.LogWarning("[Warmup] {Name} کند بود: {Ms}ms", name, sw.ElapsedMilliseconds);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            logger.LogWarning(ex, "[Warmup] {Name} ناموفق بعد از {Ms}ms", name, sw.ElapsedMilliseconds);
        }
    }

    private async Task WarmUpTokensAsync(CancellationToken ct)
    {
        var tasks = ApiSections
            .Select(section => (Name: section.Split(':')[1], Config: configuration.GetSection(section).Get<ExternalApiConfiguration>()))
            .Where(x => x.Config is { SystemId: > 0 })
            .Select(async x =>
            {
                try
                {
                    var token = await tokenProvider.GetTokenAsync(x.Name, x.Config!, ct);
                    if (token is null) logger.LogWarning("[Warmup] توکن {Name} دریافت نشد", x.Name);
                }
                catch (Exception ex) when (!ct.IsCancellationRequested)
                {
                    logger.LogWarning(ex, "[Warmup] توکن {Name} ناموفق", x.Name);
                }
            });

        await Task.WhenAll(tasks);
    }

    private static string? DecodeIfNeeded(string? connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString) || connectionString.Contains("Server", StringComparison.OrdinalIgnoreCase))
            return connectionString;
        try { return Encoding.UTF8.GetString(Convert.FromBase64String(connectionString)); }
        catch { return null; }
    }
}
