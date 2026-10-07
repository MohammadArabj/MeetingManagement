using System.Collections.Concurrent;
using System.Text.Json;

namespace EPC.SSO.Services;

/// <summary>
/// کش دیسکی فایل‌های پیوست اطلاعیه‌ها روی سرور SSO.
///
/// قبلاً هر نمایش تصویر/PDF در صفحه‌ی ورود یا داشبورد یک درخواست کامل
/// SSO → FileManagement (روی سرور دیگر) می‌زد و فایل را Proxy می‌کرد، بدون هیچ Cache-Control.
/// حالا هر فایل یک‌بار دانلود و روی دیسک محلی نگه داشته می‌شود و با PhysicalFile
/// (Kernel-mode، با پشتیبانی Range و ETag) سرو می‌شود. چون محتوای هر GUID تغییر نمی‌کند،
/// مرورگر هم می‌تواند آن را تا یک هفته کش کند.
/// </summary>
public sealed class AnnouncementFileCache
{
    public sealed record CachedFile(Guid Guid, string PhysicalPath, string ContentType, string FileName, long Length)
    {
        public string ETag => $"\"{Guid:N}-{Length}\"";
    }

    private sealed record Sidecar(Guid Guid, string ContentType, string FileName, long Length, DateTime CachedAtUtc);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<AnnouncementFileCache> _logger;
    private readonly string _root;
    private readonly long _maxFileBytes;
    private readonly ConcurrentDictionary<Guid, CachedFile> _index = new();
    private readonly SemaphoreSlim[] _locks = Enumerable.Range(0, 64).Select(_ => new SemaphoreSlim(1, 1)).ToArray();

    public AnnouncementFileCache(
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        IWebHostEnvironment environment,
        ILogger<AnnouncementFileCache> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;

        var configured = configuration["Announcements:FileCachePath"];
        _root = string.IsNullOrWhiteSpace(configured)
            ? EPC.SSO.Infrastructure.SsoPaths.Combine(configuration, "announcement-cache")
            : configured;
        _maxFileBytes = configuration.GetValue("Announcements:MaxCachedFileMb", 30L) * 1024 * 1024;

        Directory.CreateDirectory(_root);
        LoadIndex();
    }

    public long MaxFileBytes => _maxFileBytes;

    /// <summary>
    /// نوع‌هایی که می‌توانند inline (روی مبدأ SSO و حتی بدون ورود) نمایش داده شوند.
    /// HTML/SVG/XML و هر نوع دیگری اسکریپت اجرا می‌کند یا ناشناخته است و فقط به صورت دانلود سرو می‌شود.
    /// </summary>
    private static readonly HashSet<string> InlineTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp",
        "application/pdf",
        "video/mp4", "video/webm", "video/ogg",
        "audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav"
    };

    public static bool IsInlineSafe(string? contentType) =>
        !string.IsNullOrWhiteSpace(contentType) && InlineTypes.Contains(contentType.Split(';')[0].Trim());

    /// <summary>
    /// CSP برای پاسخ فایل (به جز PDF که نمایشگر مرورگر با CSP سخت‌گیرانه گاهی نمایش نمی‌دهد و اسکریپتش
    /// هم روی مبدأ سایت اجرا نمی‌شود).
    /// </summary>
    public static void ApplySandbox(HttpResponse response, string contentType)
    {
        if (string.Equals(contentType, "application/pdf", StringComparison.OrdinalIgnoreCase)) return;
        response.Headers["Content-Security-Policy"] = "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox";
    }

    public static string SafeContentType(string? contentType) =>
        IsInlineSafe(contentType) ? contentType!.Split(';')[0].Trim() : "application/octet-stream";

    public bool TryGet(Guid guid, out CachedFile? file)
    {
        if (_index.TryGetValue(guid, out var cached) && File.Exists(cached.PhysicalPath))
        {
            file = cached;
            return true;
        }

        _index.TryRemove(guid, out _);
        file = null;
        return false;
    }

    /// <summary>اگر فایل در کش نباشد و حجمش مجاز باشد دانلود می‌شود. فقط یک دانلود هم‌زمان برای هر GUID.</summary>
    public async Task<CachedFile?> GetOrDownloadAsync(Guid guid, FileMeta meta, CancellationToken cancellationToken)
    {
        if (TryGet(guid, out var existing)) return existing;
        if (meta.FileSize <= 0 || meta.FileSize > _maxFileBytes) return null;

        var gate = _locks[(guid.GetHashCode() & int.MaxValue) % _locks.Length];
        await gate.WaitAsync(cancellationToken);
        try
        {
            if (TryGet(guid, out existing)) return existing;

            using var scope = _scopeFactory.CreateScope();
            var api = scope.ServiceProvider.GetRequiredService<AnnouncementApiService>();

            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(TimeSpan.FromSeconds(90));

            using var response = await api.OpenFileAsync(guid, null, timeout.Token);
            if (response is null || !response.IsSuccessStatusCode)
            {
                _logger.LogWarning("[FileCache] دانلود {Guid} ناموفق: {Status}", guid, response?.StatusCode);
                return null;
            }

            var dataPath = DataPath(guid);
            var tempPath = dataPath + "." + Guid.NewGuid().ToString("N") + ".tmp";

            // حجم واقعی هم کنترل می‌شود (به FileSize اعلام‌شده اعتماد نمی‌کنیم)
            var tooLarge = false;
            await using (var source = await response.Content.ReadAsStreamAsync(timeout.Token))
            await using (var target = new FileStream(tempPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, useAsync: true))
            {
                var buffer = new byte[81920];
                long total = 0;
                int read;
                while ((read = await source.ReadAsync(buffer, timeout.Token)) > 0)
                {
                    total += read;
                    if (total > _maxFileBytes) { tooLarge = true; break; }
                    await target.WriteAsync(buffer.AsMemory(0, read), timeout.Token);
                }
            }

            if (tooLarge)
            {
                File.Delete(tempPath);
                _logger.LogWarning("[FileCache] {Guid} بزرگ‌تر از سقف کش است", guid);
                return null;
            }

            File.Move(tempPath, dataPath, overwrite: true);

            var contentType = SafeContentType(!string.IsNullOrWhiteSpace(meta.ContentType)
                ? meta.ContentType
                : response.Content.Headers.ContentType?.MediaType);
            var fileName = !string.IsNullOrWhiteSpace(meta.OriginalFileName) ? meta.OriginalFileName! : meta.FileName;
            var length = new FileInfo(dataPath).Length;

            var sidecar = new Sidecar(guid, contentType, fileName, length, DateTime.UtcNow);
            await File.WriteAllTextAsync(SidecarPath(guid), JsonSerializer.Serialize(sidecar), CancellationToken.None);

            var cached = new CachedFile(guid, dataPath, contentType, fileName, length);
            _index[guid] = cached;
            return cached;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[FileCache] خطا در کش کردن {Guid}", guid);
            return null;
        }
        finally
        {
            gate.Release();
        }
    }

    /// <summary>حذف فایل‌هایی که دیگر به هیچ اطلاعیه‌ای تعلق ندارند و از olderThan قدیمی‌ترند.</summary>
    public void Prune(IReadOnlySet<Guid> keep, TimeSpan olderThan)
    {
        var threshold = DateTime.UtcNow - olderThan;
        foreach (var (guid, file) in _index.ToArray())
        {
            if (keep.Contains(guid)) continue;
            try
            {
                var info = new FileInfo(file.PhysicalPath);
                if (info.Exists && info.LastWriteTimeUtc > threshold) continue;

                _index.TryRemove(guid, out _);
                File.Delete(file.PhysicalPath);
                File.Delete(SidecarPath(guid));
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "[FileCache] حذف {Guid} ممکن نشد", guid);
            }
        }

        // فایل‌های موقت جامانده از دانلودهای ناقص
        foreach (var tmp in Directory.EnumerateFiles(_root, "*.tmp"))
        {
            try
            {
                if (File.GetLastWriteTimeUtc(tmp) < DateTime.UtcNow.AddHours(-1)) File.Delete(tmp);
            }
            catch { /* ignore */ }
        }
    }

    private void LoadIndex()
    {
        foreach (var sidecarFile in Directory.EnumerateFiles(_root, "*.json"))
        {
            try
            {
                var sidecar = JsonSerializer.Deserialize<Sidecar>(File.ReadAllText(sidecarFile));
                if (sidecar is null) continue;
                var dataPath = DataPath(sidecar.Guid);
                if (!File.Exists(dataPath)) continue;
                _index[sidecar.Guid] = new CachedFile(sidecar.Guid, dataPath, sidecar.ContentType, sidecar.FileName, sidecar.Length);
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "[FileCache] sidecar نامعتبر: {File}", sidecarFile);
            }
        }
        _logger.LogInformation("[FileCache] {Count} فایل از کش دیسکی بارگذاری شد ({Root})", _index.Count, _root);
    }

    private string DataPath(Guid guid) => Path.Combine(_root, guid.ToString("N") + ".bin");
    private string SidecarPath(Guid guid) => Path.Combine(_root, guid.ToString("N") + ".json");
}
