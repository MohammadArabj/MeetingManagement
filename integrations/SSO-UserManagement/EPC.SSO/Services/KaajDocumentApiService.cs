using System.Net.Http.Headers;
using System.Text;
using System.Xml.Linq;
using Microsoft.Extensions.Caching.Memory;

namespace EPC.SSO.Services;

// ═══════════════════════════════════════════════════════════════════════════════
//  Config + DTOs
// ═══════════════════════════════════════════════════════════════════════════════

public class KaajDocumentApiConfiguration
{
    public string BaseUrl { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string RootFolderUuid { get; set; } = string.Empty;
}

public class KaajFolderDto
{
    public string Uuid { get; set; } = "";
    public string Name { get; set; } = "";
    public string Path { get; set; } = "";
    public bool HasChildren { get; set; }
    public DateTime? Created { get; set; }
}

public class KaajDocumentDto
{
    public string Uuid { get; set; } = "";
    public string Name { get; set; } = "";
    public string Path { get; set; } = "";
    public string MimeType { get; set; } = "";
    public long Size { get; set; }
    public DateTime? Created { get; set; }
    public DateTime? LastModified { get; set; }

    public bool IsImage => MimeType.StartsWith("image/", StringComparison.OrdinalIgnoreCase);
    public bool IsPdf => MimeType.Equals("application/pdf", StringComparison.OrdinalIgnoreCase);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  KaajDocumentApiService — سرویس سیستم کاج (پوشه‌بندی + دانلود اسناد)
//  توجه: پاسخ سرویس کاج به‌صورت XML است (نه JSON) و فیلد title همیشه خالی
//  می‌آید؛ نام واقعی هر آیتم از آخرین بخش path استخراج می‌شود.
// ═══════════════════════════════════════════════════════════════════════════════
//  دامنه‌ی دسترسی: کاربران فقط زیرمجموعه‌ی RootFolderUuid را می‌بینند. هر شناسه‌ای که از کلاینت می‌آید
//  (پوشه یا سند) باید قبلاً در یک Browse مجاز دیده شده باشد یا مسیرش زیر مسیر ریشه باشد؛
//  وگرنه با حساب سرویس کاج به هر سندی در کل مخزن دسترسی ایجاد می‌شد.
public class KaajDocumentApiService(
    IHttpClientFactory httpClientFactory,
    IConfiguration configuration,
    IMemoryCache cache,
    ILogger<KaajDocumentApiService> logger)
{
    private static readonly TimeSpan NodeTtl = TimeSpan.FromHours(12);
    private const string RootPathKey = "kaaj:root-path";

    private KaajDocumentApiConfiguration GetConfig() =>
        configuration.GetSection("ExternalApis:KaajDocumentApi").Get<KaajDocumentApiConfiguration>()
        ?? throw new InvalidOperationException("تنظیمات ExternalApis:KaajDocumentApi یافت نشد.");

    public string GetRootFolderUuid() => GetConfig().RootFolderUuid;

    private HttpClient CreateClient(KaajDocumentApiConfiguration cfg)
    {
        var client = httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(20);
        var authBytes = Encoding.UTF8.GetBytes($"{cfg.Username}:{cfg.Password}");
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Basic", Convert.ToBase64String(authBytes));
        return client;
    }

    public async Task<List<KaajFolderDto>> GetFoldersAsync(string folderUuid)
    {
        var cfg = GetConfig();
        try
        {
            using var client = CreateClient(cfg);
            var url = $"{cfg.BaseUrl.TrimEnd('/')}/folder/getChildren?fldId={Uri.EscapeDataString(folderUuid)}";
            var xml = await client.GetStringAsync(url);
            var folders = ParseFolders(xml);
            RememberChildren(folderUuid, folders.Select(f => f.Path));
            foreach (var f in folders.Where(f => f.Uuid.Length > 0))
                Remember(FolderKey(f.Uuid), f.Path);
            return folders;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[KaajDocumentApi] خطا در دریافت زیرپوشه‌های {FolderUuid}", folderUuid);
            return [];
        }
    }

    public async Task<List<KaajDocumentDto>> GetDocumentsAsync(string folderUuid)
    {
        var cfg = GetConfig();
        try
        {
            using var client = CreateClient(cfg);
            var url = $"{cfg.BaseUrl.TrimEnd('/')}/document/getChildren?fldId={Uri.EscapeDataString(folderUuid)}";
            var xml = await client.GetStringAsync(url);
            var documents = ParseDocuments(xml);
            RememberChildren(folderUuid, documents.Select(d => d.Path));
            foreach (var d in documents.Where(d => d.Uuid.Length > 0))
                Remember(DocumentKey(d.Uuid), d);
            return documents;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[KaajDocumentApi] خطا در دریافت فایل‌های {FolderUuid}", folderUuid);
            return [];
        }
    }

    /// <summary>
    /// دانلود به صورت Stream (بدون بارگذاری کل فایل در حافظه). پاسخ باید توسط فراخوان Dispose شود.
    /// </summary>
    public async Task<(HttpResponseMessage? Response, string ContentType, string FileName)> OpenDocumentAsync(
        string docUuid, CancellationToken ct)
    {
        var cfg = GetConfig();
        try
        {
            // HttpClient کارخانه Dispose نمی‌شود تا Stream پاسخ تا پایان ارسال باز بماند
            var client = CreateClient(cfg);
            client.Timeout = Timeout.InfiniteTimeSpan;
            using var headersTimeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            headersTimeout.CancelAfter(TimeSpan.FromSeconds(30));

            var url = $"{cfg.BaseUrl.TrimEnd('/')}/document/getContent?docId={Uri.EscapeDataString(docUuid)}";
            var response = await client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, headersTimeout.Token);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("[KaajDocumentApi] دانلود ناموفق {DocUuid}: {Status}", docUuid, response.StatusCode);
                response.Dispose();
                return (null, "", "");
            }

            var contentType = response.Content.Headers.ContentType?.MediaType ?? "application/octet-stream";
            var cd = response.Content.Headers.ContentDisposition;
            var fileName = (cd?.FileNameStar ?? cd?.FileName ?? docUuid).Trim('"');

            return (response, contentType, fileName);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            logger.LogError(ex, "[KaajDocumentApi] خطا در دانلود {DocUuid}", docUuid);
            return (null, "", "");
        }
    }

    // ─── دامنه‌ی مجاز (فقط زیر پوشه‌ی ریشه) ─────────────────────────────────────

    /// <summary>پوشه زیرمجموعه‌ی پوشه‌ی ریشه است؟</summary>
    public async Task<bool> IsFolderInScopeAsync(string folderUuid)
    {
        var root = GetRootFolderUuid();
        if (string.Equals(folderUuid, root, StringComparison.OrdinalIgnoreCase)) return true;

        var path = cache.TryGetValue(FolderKey(folderUuid), out string? known)
            ? known
            : await FetchPathAsync("folder", "fldId", folderUuid);
        if (path == null) return false;
        Remember(FolderKey(folderUuid), path);
        return await IsUnderRootAsync(path);
    }

    /// <summary>اطلاعات سند به شرط اینکه زیر پوشه‌ی ریشه باشد (در غیر این صورت null)</summary>
    public async Task<KaajDocumentDto?> GetDocumentInScopeAsync(string docUuid)
    {
        if (!cache.TryGetValue(DocumentKey(docUuid), out KaajDocumentDto? doc) || doc == null)
        {
            doc = await FetchDocumentAsync(docUuid);
            if (doc == null) return null;
            Remember(DocumentKey(docUuid), doc);
        }
        return await IsUnderRootAsync(doc.Path) ? doc : null;
    }

    private async Task<bool> IsUnderRootAsync(string path)
    {
        if (string.IsNullOrWhiteSpace(path)) return false;
        if (!cache.TryGetValue(RootPathKey, out string? rootPath) || string.IsNullOrEmpty(rootPath))
        {
            rootPath = await FetchPathAsync("folder", "fldId", GetRootFolderUuid());
            if (string.IsNullOrEmpty(rootPath)) return false;
            Remember(RootPathKey, rootPath);
        }

        var normalizedRoot = rootPath.TrimEnd('/') + "/";
        return path.StartsWith(normalizedRoot, StringComparison.Ordinal) && !path.Contains("/../");
    }

    /// <summary>مسیر ریشه از مسیر فرزندانش استخراج می‌شود (بدون فراخوانی اضافه)</summary>
    private void RememberChildren(string parentUuid, IEnumerable<string> childPaths)
    {
        var first = childPaths.FirstOrDefault(p => p.LastIndexOf('/') > 0);
        if (first == null) return;
        var parentPath = first[..first.LastIndexOf('/')];
        Remember(FolderKey(parentUuid), parentPath);
        if (string.Equals(parentUuid, GetRootFolderUuid(), StringComparison.OrdinalIgnoreCase))
            Remember(RootPathKey, parentPath);
    }

    private async Task<string?> FetchPathAsync(string kind, string idParam, string uuid)
    {
        var cfg = GetConfig();
        try
        {
            using var client = CreateClient(cfg);
            var url = $"{cfg.BaseUrl.TrimEnd('/')}/{kind}/getProperties?{idParam}={Uri.EscapeDataString(uuid)}";
            var xml = await client.GetStringAsync(url);
            return (string?)XDocument.Parse(xml).Root?.Element("path");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[KaajDocumentApi] دریافت مسیر {Kind} {Uuid} ناموفق بود", kind, uuid);
            return null;
        }
    }

    private async Task<KaajDocumentDto?> FetchDocumentAsync(string docUuid)
    {
        var cfg = GetConfig();
        try
        {
            using var client = CreateClient(cfg);
            var url = $"{cfg.BaseUrl.TrimEnd('/')}/document/getProperties?docId={Uri.EscapeDataString(docUuid)}";
            var xml = await client.GetStringAsync(url);
            var root = XDocument.Parse(xml).Root;
            return root == null ? null : ToDocument(root);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[KaajDocumentApi] دریافت مشخصات سند {DocUuid} ناموفق بود", docUuid);
            return null;
        }
    }

    private void Remember<T>(string key, T value) =>
        cache.Set(key, value, new MemoryCacheEntryOptions { Size = 1, SlidingExpiration = NodeTtl });

    private static string FolderKey(string uuid) => $"kaaj:fld:{uuid}";
    private static string DocumentKey(string uuid) => $"kaaj:doc:{uuid}";

    // ─── Parsing (XML) ───────────────────────────────────────────────────────

    private static List<KaajFolderDto> ParseFolders(string xml)
    {
        var doc = XDocument.Parse(xml);
        return doc.Root?.Elements("folder").Select(f =>
        {
            var path = (string?)f.Element("path") ?? "";
            return new KaajFolderDto
            {
                Uuid = (string?)f.Element("uuid") ?? "",
                Path = path,
                Name = ExtractNameFromPath(path),
                HasChildren = string.Equals((string?)f.Element("hasChildren"), "true", StringComparison.OrdinalIgnoreCase),
                Created = ParseDate((string?)f.Element("created")),
            };
        }).ToList() ?? [];
    }

    private static List<KaajDocumentDto> ParseDocuments(string xml)
    {
        var doc = XDocument.Parse(xml);
        return doc.Root?.Elements("document").Select(ToDocument).ToList() ?? [];
    }

    private static KaajDocumentDto ToDocument(XElement d)
    {
        var path = (string?)d.Element("path") ?? "";
        var actualVersion = d.Element("actualVersion");
        long size = 0;
        if (actualVersion != null)
            long.TryParse((string?)actualVersion.Element("size"), out size);

        return new KaajDocumentDto
        {
            Uuid = (string?)d.Element("uuid") ?? "",
            Path = path,
            Name = ExtractNameFromPath(path),
            MimeType = (string?)d.Element("mimeType") ?? "application/octet-stream",
            Size = size,
            Created = ParseDate((string?)d.Element("created")),
            LastModified = ParseDate((string?)d.Element("lastModified")),
        };
    }

    private static string ExtractNameFromPath(string path)
    {
        if (string.IsNullOrWhiteSpace(path)) return "";
        var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        return segments.Length > 0 ? segments[^1] : path;
    }

    private static DateTime? ParseDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return DateTimeOffset.TryParse(value, out var dto) ? dto.DateTime : null;
    }
}