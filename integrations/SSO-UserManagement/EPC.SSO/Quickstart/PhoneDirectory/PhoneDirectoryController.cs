using EPC.SSO.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace EPC.SSO.Quickstart.PhoneDirectory;

[AllowAnonymous]
public class PhoneDirectoryController(
    PhoneDirectoryApiService directoryService,
    IDataProtectionProvider dataProtectionProvider,
    IHttpClientFactory httpClientFactory,
    IMemoryCache cache,
    IConfiguration configuration,
    ILogger<PhoneDirectoryController> logger) : Controller
{
    /// <summary>هدف (purpose) توکن عکس — باید در ویو هم دقیقاً همین مقدار استفاده شود</summary>
    public const string PhotoPurpose = "EPC.SSO.PhoneDirectory.Photo";

    private readonly IDataProtector _photoProtector =
        dataProtectionProvider.CreateProtector(PhotoPurpose);

    [HttpGet]
    public IActionResult Index()
    {
        return View();
    }

    [HttpPost]
    public async Task<IActionResult> Search(
        [FromForm] string? search,
        [FromForm] int? type)
    {
        var results = await directoryService.SearchAsync(
            search ?? string.Empty,
            type);

        return PartialView("_DirectoryResults", results);
    }

    [HttpPost]
    public async Task<IActionResult> SearchPaginated(
        [FromForm] string? search,
        [FromForm] int? type,
        [FromForm] int page = 1,
        [FromForm] int pageSize = 12)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var result = await directoryService.SearchPaginatedAsync(
            search?.Trim() ?? string.Empty,
            type,
            page,
            pageSize);

        // ارتباط با API برقرار نشده: به‌جای «نتیجه‌ی خالی»، خطا برمی‌گردانیم
        // تا مرورگر خودکار چند بار دوباره تلاش کند.
        if (result.HasError)
            return StatusCode(StatusCodes.Status503ServiceUnavailable);

        return PartialView("_DirectoryResults", result);
    }

    /// <summary>
    /// عکس همکار — از طریق SSO و با توکن رمزنگاری‌شده.
    /// آدرس سرور مدیریت فایل و نام‌کاربری هیچ‌وقت به مرورگر نمی‌رسد،
    /// و باز کردن مستقیم آدرس در تب جدید جواب نمی‌دهد.
    /// </summary>
    [HttpGet]
    [ResponseCache(Duration = 3600, Location = ResponseCacheLocation.Client)]
    public async Task<IActionResult> Photo(string? t, CancellationToken ct)
    {
        // فقط درخواست‌های fetch/img از داخل خود صفحه؛ نه باز کردن مستقیم یا hotlink
        var dest = Request.Headers["Sec-Fetch-Dest"].ToString();
        var site = Request.Headers["Sec-Fetch-Site"].ToString();
        if (dest is "document" or "iframe" or "frame" or "embed" or "object" || site == "cross-site")
            return NotFound();

        if (string.IsNullOrWhiteSpace(t))
            return NotFound();

        string userName;
        try
        {
            userName = _photoProtector.Unprotect(t);
        }
        catch
        {
            return NotFound();
        }

        var cacheKey = $"pd-photo:{userName}";
        if (!cache.TryGetValue(cacheKey, out byte[]? bytes))
        {
            bytes = await FetchPhotoAsync(userName, ct);
            var cacheEntryOptions = new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = bytes is null ? TimeSpan.FromMinutes(5) : TimeSpan.FromHours(1),
                // Use bytes length when available; use 1 for "null" placeholder entries.
                Size = bytes?.Length ?? 1L
            };
            cache.Set(cacheKey, bytes, cacheEntryOptions);
        }

        if (bytes is null)
            return NotFound();

        Response.Headers.XContentTypeOptions = "nosniff";
        return File(bytes, "image/jpeg");
    }

    /// <summary>
    /// توکن نمایش عکس سامانه‌ی مدیریت فایل (عکس‌ها دیگر بدون ورود سرو نمی‌شوند).
    /// mt = "{exp}.{Base64Url(HMAC-SHA256(PhotoTokenKey, "photo|{exp}"))}"؛ کلید مشترک با FileSettings:PhotoTokenKey.
    /// </summary>
    private string PhotoTokenParam()
    {
        var key = configuration["PhoneDirectory:PhotoTokenKey"] ?? configuration["FileManagement:PhotoTokenKey"];
        if (string.IsNullOrWhiteSpace(key)) return string.Empty;

        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var exp = now - now % 3600 + 2 * 3600;
        using var hmac = new System.Security.Cryptography.HMACSHA256(System.Text.Encoding.UTF8.GetBytes(key));
        var sig = Convert.ToBase64String(hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes($"photo|{exp}")))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
        return $"&mt={Uri.EscapeDataString($"{exp}.{sig}")}";
    }

    private async Task<byte[]?> FetchPhotoAsync(string userName, CancellationToken ct)
    {
        var baseUrl = configuration["PhoneDirectory:ImageBaseUrl"]
                      ?? configuration["ExternalApis:FileManagementApi:BaseUrl"];
        if (string.IsNullOrWhiteSpace(baseUrl))
            return null;

        var safeName = Path.GetFileName(userName);
        if (string.IsNullOrWhiteSpace(safeName))
            return null;

        // عکس کوچک (۹۶ پیکسل): برای نمایش کافی است و برای ذخیره کم‌ارزش
        var url = $"{baseUrl.TrimEnd('/')}/api/Image/profile/{Uri.EscapeDataString(safeName + ".jpg")}?w=96&q=70{PhotoTokenParam()}";

        try
        {
            var client = httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(6);

            using var response = await client.GetAsync(url, ct);
            if (!response.IsSuccessStatusCode)
                return null;

            return await response.Content.ReadAsByteArrayAsync(ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "دریافت عکس دفترچه تلفن ناموفق بود");
            return null;
        }
    }
}