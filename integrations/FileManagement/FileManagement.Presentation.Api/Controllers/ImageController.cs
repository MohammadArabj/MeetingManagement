using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using SkiaSharp;

namespace FileManagement.Presentation.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "FileManagementApi")]
public class ImageController(
    IConfiguration configuration,
    IWebHostEnvironment webHostEnvironment) : ControllerBase
{
    // مقادیر مجاز برای جلوگیری از سوءاستفاده
    private static readonly int[] AllowedWidths = [32, 48, 64, 96, 128, 256, 512];
    private static readonly int MinQuality = 30;
    private static readonly int MaxQuality = 100;
    private static readonly int DefaultQuality = 75;
    private static readonly int DefaultWidth = 48;

    /// <summary>
    /// GET /api/Image?url=photo/username.jpg&w=48&q=75
    /// </summary>
    [HttpGet]
    [AllowAnonymous] // یا Authorize بسته به نیاز
    [ResponseCache(Duration = 86400, Location = ResponseCacheLocation.Any)] // کش ۲۴ ساعته
    public IActionResult GetOptimized(
        [FromQuery] string url,
        [FromQuery] int? w,
        [FromQuery] int? q)
    {
        if (string.IsNullOrWhiteSpace(url))
            return BadRequest(new { message = "پارامتر url الزامی است" });

        // ---- تعیین پارامترها ----
        var width = GetClosestAllowedWidth(w ?? DefaultWidth);
        var quality = Math.Clamp(q ?? DefaultQuality, MinQuality, MaxQuality);

        // ---- پیدا کردن فایل فیزیکی ----
        var physicalPath = ResolvePhysicalPath(url);
        if (physicalPath == null || !System.IO.File.Exists(physicalPath))
            return NotFound(new { message = "تصویر یافت نشد" });

        // ---- خواندن و تغییر اندازه ----
        try
        {
            using var inputStream = System.IO.File.OpenRead(physicalPath);
            using var original = SKBitmap.Decode(inputStream);

            if (original == null)
                return BadRequest(new { message = "فایل تصویری معتبر نیست" });

            // محاسبه ارتفاع متناسب
            var height = (int)Math.Round((double)original.Height / original.Width * width);

            using var resized = original.Resize(new SKImageInfo(width, height), new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.Linear));
            if (resized == null)
                return StatusCode(500, new { message = "خطا در تغییر اندازه" });

            using var image = SKImage.FromBitmap(resized);
            using var data = image.Encode(SKEncodedImageFormat.Jpeg, quality);

            // ---- هدرهای محافظتی ----
            Response.Headers["Cache-Control"] = "public, max-age=86400, immutable";
            Response.Headers["Content-Disposition"] = "inline";
            Response.Headers["X-Content-Type-Options"] = "nosniff";

            return File(data.ToArray(), "image/jpeg");
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "خطا در پردازش تصویر", detail = ex.Message });
        }
    }

    /// <summary>
    /// اندپوینت اختصاصی پروفایل - بدون نیاز به URL کامل
    /// GET /api/Image/profile/username.jpg?w=48&q=75
    /// </summary>
    [HttpGet("profile/{fileName}")]
    [AllowAnonymous]
    [ResponseCache(Duration = 86400, Location = ResponseCacheLocation.Any)]
    public IActionResult GetProfileImage(
        string fileName,
        [FromQuery] int? w,
        [FromQuery] int? q)
    {
        // فقط فایل‌های jpg/png مجاز
        var ext = Path.GetExtension(fileName)?.ToLowerInvariant();
        if (ext is not (".jpg" or ".jpeg" or ".png"))
            return BadRequest(new { message = "فرمت فایل مجاز نیست" });

        // ساخت مسیر امن
        var safeName = Path.GetFileName(fileName); // جلوگیری از path traversal
        var url = $"photo/{safeName}";

        return GetOptimized(url, w, q);
    }

    // ========== Helpers ==========

    private static int GetClosestAllowedWidth(int requested)
    {
        // نزدیک‌ترین سایز مجاز (بالاتر)
        foreach (var allowed in AllowedWidths)
        {
            if (allowed >= requested)
                return allowed;
        }
        return AllowedWidths[^1]; // بزرگ‌ترین
    }

    private string? ResolvePhysicalPath(string url)
    {
        if (string.IsNullOrWhiteSpace(url))
            return null;

        // پاکسازی URL
        var normalized = Uri.UnescapeDataString(url)
            .Replace('\\', '/')
            .TrimStart('/');

        // جلوگیری از path traversal
        if (normalized.Contains("..") || normalized.Contains(':'))
            return null;

        // بررسی مسیرهای مختلف
        // 1. wwwroot
        var wwwrootPath = Path.Combine(
            webHostEnvironment.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"),
            normalized.Replace('/', Path.DirectorySeparatorChar));

        if (System.IO.File.Exists(wwwrootPath))
            return Path.GetFullPath(wwwrootPath);

        // 2. FileBasePath
        var basePathFromConfig = configuration["FileSettings:FileBasePath"];
        var contentRoot = webHostEnvironment.ContentRootPath ?? Directory.GetCurrentDirectory();
        var basePath = string.IsNullOrWhiteSpace(basePathFromConfig)
            ? Path.Combine(contentRoot, "files")
            : basePathFromConfig;

        if (!Path.IsPathRooted(basePath))
            basePath = Path.GetFullPath(Path.Combine(contentRoot, basePath));

        var filePath = Path.GetFullPath(Path.Combine(basePath, normalized.Replace('/', Path.DirectorySeparatorChar)));

        // اطمینان از اینکه خارج از basePath نرفته
        if (!filePath.StartsWith(Path.GetFullPath(basePath), StringComparison.OrdinalIgnoreCase))
            return null;

        return System.IO.File.Exists(filePath) ? filePath : null;
    }
}