using FileManagement.Common;
using FileManagement.Presentation.Api.Media;
using FileManagement.Presentation.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FileManagement.Presentation.Api.Controllers;

/// <summary>
/// عکس پرسنلی بهینه‌شده (بندانگشتی کش‌شده روی دیسک، WebP/JPEG).
/// ─────────────────────────────────────────────────────────────────────────
/// قبلاً این اندپوینت بدون ورود هر تصویری را از wwwroot و حتی پوشه‌ی پیوست‌ها برمی‌گرداند
/// (یعنی دور زدن آدرس امضاشده‌ی فایل‌ها). حالا فقط از پوشه‌ی عکس‌های پرسنلی می‌خواند و
/// نیاز به ورود (Bearer) یا توکن کوتاه‌مدت mt دارد (api/Media/Token).
/// </summary>
[ApiController]
[Route("api/[controller]")]
[AllowAnonymous] // احراز دسترسی در MediaAccess (Bearer یا mt)؛ تگ img هدر Authorization نمی‌فرستد
public class ImageController(
    MediaAccess access,
    FileStorageLocations locations,
    ImageThumbnailService thumbnails,
    MediaResponses responses) : ControllerBase
{
    /// <summary>GET /api/Image?url=photo/username.jpg&amp;w=48&amp;q=75&amp;mt=…</summary>
    [HttpGet]
    public async Task GetOptimized([FromQuery] string? url, [FromQuery] int? w)
    {
        var fileName = PhotoFileName(url);
        if (fileName == null)
        {
            Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        await MediaEndpoints.ServePhotoCoreAsync(HttpContext, fileName, w ?? 48, access, locations, thumbnails, responses);
    }

    /// <summary>GET /api/Image/profile/username.jpg?w=48&amp;q=75&amp;mt=…</summary>
    [HttpGet("profile/{fileName}")]
    public Task GetProfileImage(string fileName, [FromQuery] int? w)
        => MediaEndpoints.ServePhotoCoreAsync(HttpContext, Path.GetFileName(fileName), w ?? 96, access, locations, thumbnails, responses);

    /// <summary>فقط «photo/{name}» پذیرفته می‌شود؛ هر مسیر دیگری (پیوست، امضا، …) در دسترس نیست</summary>
    private static string? PhotoFileName(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;
        var normalized = Uri.UnescapeDataString(url).Replace('\\', '/').TrimStart('/');
        if (!normalized.StartsWith("photo/", StringComparison.OrdinalIgnoreCase)) return null;
        var name = normalized["photo/".Length..];
        return FileStorageLocations.IsSafeName(name) ? name : null;
    }
}
