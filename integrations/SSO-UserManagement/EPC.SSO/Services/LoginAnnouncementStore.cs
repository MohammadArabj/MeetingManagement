using System.Text.Json;
using System.Threading.Channels;

namespace EPC.SSO.Services;

public sealed class LoginAnnouncementFile
{
    public Guid FileGuid { get; init; }
    public int FileType { get; init; }
    public string DisplayName { get; init; } = string.Empty;
    public string ContentType { get; init; } = "application/octet-stream";
    public long FileSize { get; init; }
    public string FileUrl => $"/Account/FileProxy?guid={FileGuid}";
    public bool IsImage => ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase);
    public bool IsPdf => ContentType.Equals("application/pdf", StringComparison.OrdinalIgnoreCase);
}

public sealed class LoginAnnouncementItem
{
    public string Title { get; init; } = string.Empty;
    public string Body { get; init; } = string.Empty;
    public string Type { get; init; } = "info";
    public string Date { get; init; } = string.Empty;
    public int Priority { get; init; }
    public List<LoginAnnouncementFile> Files { get; init; } = [];
}

public sealed class LoginAnnouncementSnapshot
{
    public static readonly LoginAnnouncementSnapshot Empty = new();

    public List<LoginAnnouncementItem> Items { get; init; } = [];
    public DateTime RefreshedAtUtc { get; init; }
    public bool IsLoaded { get; init; }

    public bool ContainsFile(Guid guid) => Items.Any(i => i.Files.Any(f => f.FileGuid == guid));
    public LoginAnnouncementFile? FindFile(Guid guid) => Items.SelectMany(i => i.Files).FirstOrDefault(f => f.FileGuid == guid);
}

/// <summary>
/// منبع اطلاعیه‌های صفحه‌ی ورود — همیشه از حافظه پاسخ می‌دهد و هیچ درخواست کاربر منتظر API نمی‌ماند.
///   • در پس‌زمینه هر N ثانیه به‌روز می‌شود (LoginAnnouncementRefreshService).
///   • اگر API در دسترس نباشد آخرین نسخه‌ی سالم باقی می‌ماند.
///   • روی دیسک ذخیره می‌شود، پس بلافاصله بعد از ری‌استارت هم اطلاعیه‌ها آماده‌اند.
/// </summary>
public sealed class LoginAnnouncementStore
{
    private readonly string _snapshotPath;
    private readonly Channel<bool> _refreshSignal = Channel.CreateBounded<bool>(new BoundedChannelOptions(1)
    {
        FullMode = BoundedChannelFullMode.DropWrite
    });

    private volatile LoginAnnouncementSnapshot _current = LoginAnnouncementSnapshot.Empty;

    public LoginAnnouncementStore(IConfiguration configuration, IWebHostEnvironment environment, ILogger<LoginAnnouncementStore> logger)
    {
        var dir = configuration["Announcements:FileCachePath"];
        dir = string.IsNullOrWhiteSpace(dir) ? EPC.SSO.Infrastructure.SsoPaths.Combine(configuration, "announcement-cache") : dir;
        Directory.CreateDirectory(dir);
        _snapshotPath = Path.Combine(dir, "login-snapshot.json");

        try
        {
            if (File.Exists(_snapshotPath))
            {
                var loaded = JsonSerializer.Deserialize<LoginAnnouncementSnapshot>(File.ReadAllText(_snapshotPath));
                if (loaded is not null)
                {
                    _current = new LoginAnnouncementSnapshot { Items = loaded.Items, RefreshedAtUtc = loaded.RefreshedAtUtc, IsLoaded = true };
                    logger.LogInformation("[LoginAnnouncements] {Count} اطلاعیه از دیسک بارگذاری شد", loaded.Items.Count);
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[LoginAnnouncements] خواندن snapshot از دیسک ناموفق بود");
        }
    }

    public LoginAnnouncementSnapshot Current => _current;

    public ChannelReader<bool> RefreshRequests => _refreshSignal.Reader;

    /// <summary>درخواست به‌روزرسانی فوری (مثلاً بعد از انتشار اطلاعیه‌ی جدید).</summary>
    public void RequestRefresh() => _refreshSignal.Writer.TryWrite(true);

    internal void Publish(LoginAnnouncementSnapshot snapshot)
    {
        _current = snapshot;
        try
        {
            var tmp = _snapshotPath + ".tmp";
            File.WriteAllText(tmp, JsonSerializer.Serialize(snapshot));
            File.Move(tmp, _snapshotPath, overwrite: true);
        }
        catch
        {
            // ذخیره روی دیسک فقط برای شروع سریع‌تر است؛ خطایش مهم نیست.
        }
    }
}

public sealed class LoginAnnouncementRefreshService(
    LoginAnnouncementStore store,
    AnnouncementFileCache fileCache,
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration,
    ILogger<LoginAnnouncementRefreshService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var interval = TimeSpan.FromSeconds(Math.Max(15, configuration.GetValue("Announcements:RefreshSeconds", 60)));

        // کمی صبر تا Kestrel/IIS کامل بالا بیاید (SSO برای توکن با خودش تماس می‌گیرد)
        await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            await RefreshOnceAsync(stoppingToken);

            using var waitCts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
            waitCts.CancelAfter(interval);
            try
            {
                // یا تا پایان interval صبر می‌کنیم، یا تا وقتی RequestRefresh صدا زده شود
                await store.RefreshRequests.WaitToReadAsync(waitCts.Token);
                while (store.RefreshRequests.TryRead(out _)) { }
            }
            catch (OperationCanceledException) when (!stoppingToken.IsCancellationRequested)
            {
                // interval تمام شد
            }
        }
    }

    private async Task RefreshOnceAsync(CancellationToken stoppingToken)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var api = scope.ServiceProvider.GetRequiredService<AnnouncementApiService>();

            var dtos = await api.FetchLoginAnnouncementsAsync(stoppingToken);
            if (dtos is null)
            {
                logger.LogWarning("[LoginAnnouncements] API اطلاعیه پاسخ نداد؛ نسخه‌ی قبلی حفظ شد");
                return;
            }

            var guids = dtos.SelectMany(d => d.Files ?? []).Select(f => f.FileGuid)
                .Where(g => g != Guid.Empty).Distinct().ToList();

            List<FileMeta>? metas = guids.Count == 0
                ? new List<FileMeta>()
                : await api.GetFileMetasAsync(guids, stoppingToken);

            if (metas is null && guids.Count > 0)
            {
                logger.LogWarning("[LoginAnnouncements] FileManagement پاسخ نداد؛ نسخه‌ی قبلی حفظ شد");
                return;
            }

            // FileManagement ممکن است یک فایل را دو بار برگرداند؛ ToDictionary خطا می‌داد و به‌روزرسانی متوقف می‌شد
            var metaMap = (metas ?? []).GroupBy(m => m.Guid).ToDictionary(g => g.Key, g => g.First());

            var items = dtos.Select(d => new LoginAnnouncementItem
            {
                Title = d.Title,
                Body = d.Body,
                Type = string.IsNullOrWhiteSpace(d.Type) ? "info" : d.Type,
                Date = d.Date,
                Priority = d.Priority,
                Files = (d.Files ?? [])
                    .Where(f => metaMap.ContainsKey(f.FileGuid))
                    .Select(f =>
                    {
                        var m = metaMap[f.FileGuid];
                        return new LoginAnnouncementFile
                        {
                            FileGuid = f.FileGuid,
                            FileType = f.FileType,
                            DisplayName = !string.IsNullOrWhiteSpace(m.OriginalFileName) ? m.OriginalFileName! : m.FileName,
                            ContentType = string.IsNullOrWhiteSpace(m.ContentType) ? "application/octet-stream" : m.ContentType,
                            FileSize = m.FileSize
                        };
                    })
                    .ToList()
            }).ToList();

            // پیش‌دانلود فایل‌ها قبل از انتشار snapshot، تا اولین بازدیدکننده هم سریع ببیند.
            foreach (var guid in guids)
            {
                if (metaMap.TryGetValue(guid, out var meta))
                    await fileCache.GetOrDownloadAsync(guid, meta, stoppingToken);
            }

            store.Publish(new LoginAnnouncementSnapshot { Items = items, RefreshedAtUtc = DateTime.UtcNow, IsLoaded = true });
            fileCache.Prune(guids.ToHashSet(), TimeSpan.FromDays(3));
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[LoginAnnouncements] خطا در به‌روزرسانی");
        }
    }
}
