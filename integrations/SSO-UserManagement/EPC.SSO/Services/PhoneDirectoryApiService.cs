namespace EPC.SSO.Services;

public class PhoneDirectoryApiService(
    ExternalApiClientService externalApiClientService,
    IConfiguration configuration,
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

    public async Task<List<PhoneDirectoryPublicModel>> SearchAsync(string searchTerm, int? type = null, CancellationToken cancellationToken = default)
    {
        var (ok, data) = await PostWithRetryAsync<List<PhoneDirectoryPublicModel>>(
            "/api/PhoneDirectory/Search",
            new { Search = searchTerm, Type = type }, cancellationToken);

        return ok ? data ?? [] : [];
    }

    public async Task<PhoneDirectoryPaginatedResult> SearchPaginatedAsync(
        string searchTerm,
        int? type,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var (ok, data) = await PostWithRetryAsync<PhoneDirectoryPaginatedResult>(
            "/api/PhoneDirectory/SearchPaginated",
            new { Search = searchTerm, Type = type, Page = page, PageSize = pageSize }, cancellationToken);

        if (!ok)
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

        var result = data ?? new PhoneDirectoryPaginatedResult();
        if (result.Page <= 0) result.Page = page;
        if (result.PageSize <= 0) result.PageSize = pageSize;
        return result;
    }
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