using FileManagement.Common;

namespace FileManagement.Presentation.Api.Media;

/// <summary>
/// پاک‌سازی دوره‌ای کش بندانگشتی‌ها: حذف فایل‌های استفاده‌نشده (پیش‌فرض ۳۰ روز) و نگه داشتن حجم کل
/// زیر سقف FileSettings:CacheMaxMegabytes (قدیمی‌ترین‌ها اول حذف می‌شوند). فایل‌های موقت نیمه‌کاره هم پاک می‌شوند.
/// </summary>
public sealed class MediaCacheSweeper(FileStorageLocations locations, IConfiguration configuration, ILogger<MediaCacheSweeper> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var maxAge = TimeSpan.FromDays(Math.Clamp(configuration.GetValue("FileSettings:CacheMaxAgeDays", 30), 1, 365));
        var maxBytes = Math.Max(64, configuration.GetValue("FileSettings:CacheMaxMegabytes", 2048)) * 1024L * 1024;

        try { await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken); }
        catch (OperationCanceledException) { return; }

        using var timer = new PeriodicTimer(TimeSpan.FromHours(6));
        do
        {
            try { Sweep(maxAge, maxBytes); }
            catch (Exception ex) { logger.LogWarning(ex, "Media cache sweep failed"); }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken).ConfigureAwait(false));
    }

    private void Sweep(TimeSpan maxAge, long maxBytes)
    {
        var root = Path.Combine(locations.CacheRoot, "img");
        if (!Directory.Exists(root)) return;

        var now = DateTime.UtcNow;
        var files = new DirectoryInfo(root).EnumerateFiles("*", SearchOption.AllDirectories)
            .OrderBy(f => f.LastWriteTimeUtc)
            .ToList();

        long total = files.Sum(f => f.Length);
        var removed = 0;
        foreach (var file in files)
        {
            var stale = file.Extension == ".tmp" ? now - file.LastWriteTimeUtc > TimeSpan.FromHours(1) : now - file.LastWriteTimeUtc > maxAge;
            if (!stale && total <= maxBytes) continue;
            try
            {
                total -= file.Length;
                file.Delete();
                removed++;
            }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        }

        if (removed > 0) logger.LogInformation("Media cache sweep removed {Count} files", removed);
    }
}
