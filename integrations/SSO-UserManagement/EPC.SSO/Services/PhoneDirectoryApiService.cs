namespace EPC.SSO.Services;

public class PhoneDirectoryApiService(
    ExternalApiClientService externalApiClientService,
    IConfiguration configuration,
    EPC.SSO.Infrastructure.IAppCache cache,
    ILogger<PhoneDirectoryApiService> logger)
{
    private const string ApiName = "PhoneDirectoryApi";

    // اگر تماس اول (مثلاً به‌خاطر توکن یا اتصال سرد) شکست خورد، یک‌بار دیگر تلاش می‌کنیم
    private const int MaxAttempts = 2;
    private static readonly TimeSpan RetryDelay = TimeSpan.FromMilliseconds(400);

    private ExternalApiConfiguration GetApiConfig()
    {
        var section = configuration.GetSection($"ExternalApis:{ApiName}");
        return new ExternalApiConfiguration
        {
            BaseUrl = section["BaseUrl"]
                ?? throw new InvalidOperationException($"تنظیمات {ApiName}:BaseUrl یافت نشد"),
            SystemId = int.Parse(section["SystemId"]
                ?? throw new InvalidOperationException($"تنظیمات {ApiName}:SystemId یافت نشد")),
            ScopeId = int.Parse(section["ScopeId"]
                ?? throw new InvalidOperationException($"تنظیمات {ApiName}:ScopeId یافت نشد")),
        };
    }

    /// <summary>
    /// فراخوانی API با تلاش مجدد. Ok=false یعنی واقعاً ارتباط/پاسخ ناموفق بوده
    /// (نه اینکه نتیجه‌ی جستجو خالی باشد).
    /// </summary>
    /// فقط خطای ارتباط (پاسخ null) دوباره تلاش می‌شود؛ پاسخ IsSuccess=false نتیجه‌ی واقعی سرویس است.
    /// با قطع اتصال کاربر (cancellationToken) فراخوانی‌ها هم لغو می‌شوند.
    private async Task<(bool Ok, TData? Data)> PostWithRetryAsync<TData>(string endpoint, object payload, CancellationToken cancellationToken)
        where TData : class
    {
        var apiConfig = GetApiConfig();

        for (var attempt = 1; attempt <= MaxAttempts; attempt++)
        {
            var result = await externalApiClientService.PostAsync<
                object,
                PhoneDirectoryApiResult<TData>>(ApiName, apiConfig, endpoint, payload, cancellationToken);

            if (result is { IsSuccess: true })
                return (true, result.Data);

            if (result is not null)
            {
                logger.LogWarning("[{ApiName}] {Endpoint} پاسخ ناموفق برگرداند", ApiName, endpoint);
                return (false, null);
            }

            logger.LogWarning("[{ApiName}] {Endpoint} ناموفق بود (تلاش {Attempt} از {Max})",
                ApiName, endpoint, attempt, MaxAttempts);

            if (attempt < MaxAttempts)
                await Task.Delay(RetryDelay, cancellationToken);
        }

        return (false, null);
    }

    // ════════════════════════════════════════════════════════════════════
    //  کش کامل دفترچه + جستجو در حافظه
    // ════════════════════════════════════════════════════════════════════
    // قبلاً هر جستجو/ورق‌زدن/هر حرف تایپ‌شده یک درخواست به API دفترچه می‌زد و آن API هم هر بار کل جدول را
    // می‌خواند و برای «همه‌ی» سمت‌ها از UserManagement نام متصدی می‌گرفت (چند ثانیه برای هر جستجو).
    // حالا کل دفترچه (چند هزار ردیف، چند صد کیلوبایت) در SSO نگه داشته می‌شود:
    //  • ۳ دقیقه تازه؛ پس از آن نسخه‌ی قبلی فوراً برگردانده و در پس‌زمینه تازه می‌شود (تا ۲۴ ساعت پشتیبان)
    //  • در شروع برنامه و هر ۳ دقیقه گرم می‌شود (ExternalApiWarmupService) ← هیچ کاربری منتظر API نمی‌ماند
    //  • جستجو و صفحه‌بندی در حافظه با یکسان‌سازی حروف فارسی/عربی و ارقام (چند میلی‌ثانیه)

    private const string CacheKey = "phone-directory:all:v2";
    private static readonly TimeSpan FreshFor = TimeSpan.FromMinutes(3);
    private static readonly TimeSpan StaleFor = TimeSpan.FromHours(24);

    /// <summary>کل دفترچه‌ی فعال (همراه متن جستجوی یکسان‌سازی‌شده)؛ null = در دسترس نیست و نسخه‌ی قبلی هم نداریم</summary>
    public Task<IndexedDirectory?> GetAllAsync(CancellationToken cancellationToken = default) =>
        cache.GetOrCreateAsync(CacheKey, LoadAllAsync, FreshFor, StaleFor, cancellationToken);

    private async Task<IndexedDirectory?> LoadAllAsync(CancellationToken ct)
    {
        var (ok, data) = await PostWithRetryAsync<List<PhoneDirectoryPublicModel>>(
            "/api/PhoneDirectory/Search", new { Search = string.Empty, Type = (int?)null }, ct);
        if (!ok || data is null) return null;

        var items = data
            .Select(x => new IndexedEntry(x, Normalize(string.Join(' ',
                x.DisplayTitle, x.SubTitle, x.Unit, x.UserName, x.TypeLabel, string.Join(' ', x.Numbers ?? []),
                // شماره‌ها بدون خط تیره/فاصله هم قابل جستجو باشند (۰۲۱۱۲۳۴ ↔ ۰۲۱-۱۲۳۴)
                string.Join(' ', (x.Numbers ?? []).Select(n => new string(Normalize(n).Where(char.IsAsciiDigit).ToArray())))))))
            // ترتیب ثابت و قابل‌پیش‌بینی: سمت‌ها سپس مکان‌ها، هر کدام بر اساس نام
            .OrderBy(x => x.Model.Type)
            .ThenBy(x => x.Model.Type == 1 ? x.Model.SubTitle ?? x.Model.DisplayTitle : x.Model.DisplayTitle, StringComparer.Create(FaCulture, true))
            .ToList();
        logger.LogInformation("[{ApiName}] دفترچه‌ی تلفن بارگذاری شد: {Count} مورد", ApiName, items.Count);
        return new IndexedDirectory(items);
    }

    public async Task<List<PhoneDirectoryPublicModel>> SearchAsync(string searchTerm, int? type = null, CancellationToken cancellationToken = default)
    {
        var all = await GetAllAsync(cancellationToken);
        return all is null ? [] : Filter(all, searchTerm, type).Select(x => x.Model).ToList();
    }

    public async Task<PhoneDirectoryPaginatedResult> SearchPaginatedAsync(
        string searchTerm,
        int? type,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var all = await GetAllAsync(cancellationToken);
        if (all is null)
        {
            return new PhoneDirectoryPaginatedResult
            {
                Items = [],
                Total = 0,
                Page = page,
                PageSize = pageSize,
                HasError = true          // کنترلر با این پرچم، خطای ۵۰۳ می‌دهد تا مرورگر دوباره تلاش کند
            };
        }

        var matches = Filter(all, searchTerm, type);
        var totalPages = Math.Max(1, (int)Math.Ceiling(matches.Count / (double)pageSize));
        page = Math.Clamp(page, 1, totalPages);

        return new PhoneDirectoryPaginatedResult
        {
            Items = matches.Skip((page - 1) * pageSize).Take(pageSize).Select(x => x.Model).ToList(),
            Total = matches.Count,
            Page = page,
            PageSize = pageSize,
        };
    }

    /// <summary>همه‌ی کلمات جستجو باید پیدا شوند (به هر ترتیب)؛ «علی رضایی ۲۱۴» هم پیدا می‌شود</summary>
    private static List<IndexedEntry> Filter(IndexedDirectory all, string? searchTerm, int? type)
    {
        var terms = Normalize(searchTerm ?? string.Empty)
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        IEnumerable<IndexedEntry> q = all.Items;
        if (type is 1 or 2) q = q.Where(x => x.Model.Type == type);
        if (terms.Length > 0) q = q.Where(x => terms.All(t => x.Haystack.Contains(t, StringComparison.Ordinal)));
        return q.ToList();
    }

    private static readonly System.Globalization.CultureInfo FaCulture = new("fa-IR");

    /// <summary>یکسان‌سازی: ي/ی، ك/ک، ة/ه، أإآ/ا، ارقام فارسی/عربی به لاتین، حذف نیم‌فاصله و اعراب، حروف کوچک</summary>
    public static string Normalize(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        var sb = new System.Text.StringBuilder(text.Length);
        foreach (var ch in text)
        {
            var c = ch switch
            {
                'ي' or 'ى' => 'ی',
                'ك' => 'ک',
                'ة' => 'ه',
                'أ' or 'إ' or 'آ' or 'ٱ' => 'ا',
                'ؤ' => 'و',
                '\u200c' or '\u200f' or '\u200e' or '-' or '_' or '/' => ' ',
                >= '۰' and <= '۹' => (char)('0' + (ch - '۰')),
                >= '٠' and <= '٩' => (char)('0' + (ch - '٠')),
                _ => char.ToLowerInvariant(ch)
            };
            if (c is >= '\u064B' and <= '\u065F') continue; // اعراب
            sb.Append(c);
        }
        return System.Text.RegularExpressions.Regex.Replace(sb.ToString(), @"\s+", " ").Trim();
    }
}

public sealed record IndexedEntry(PhoneDirectoryPublicModel Model, string Haystack);

public sealed class IndexedDirectory(List<IndexedEntry> items)
{
    public IReadOnlyList<IndexedEntry> Items { get; } = items;
}

// === کلاس‌های مدل مورد نیاز ===
public class PhoneDirectoryPaginatedResult
{
    public List<PhoneDirectoryPublicModel> Items { get; set; } = [];
    public int Total { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }

    /// <summary>true = ارتباط با سرویس دفترچه تلفن برقرار نشد (نه اینکه نتیجه خالی باشد)</summary>
    public bool HasError { get; set; }
}