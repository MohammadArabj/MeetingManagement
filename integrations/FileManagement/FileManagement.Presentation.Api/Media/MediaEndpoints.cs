using FileManagement.Common;
using FileManagement.Presentation.Api.Security;

namespace FileManagement.Presentation.Api.Media;

/// <summary>
/// سرو فایل‌ها بدون Static Files عمومی:
///   GET /files/{**path}?exp&amp;sig[&amp;w]        پیوست‌ها با آدرس امضاشده (+ بندانگشتی تصاویر با w)
///   GET /media/signature/{userName}?exp&amp;sig    تصویر امضا (آدرس صادرشده توسط سامانه‌ی صاحب فرایند)
///   GET /photo/{fileName}?mt[&amp;w]               عکس پرسنلی (سازگار با آدرس قدیمی، با توکن)
///   GET /api/Media/Token                         توکن عکس برای کاربر واردشده
/// </summary>
public static class MediaEndpoints
{
    public static IEndpointRouteBuilder MapMediaEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapMethods("/files/{**path}", [HttpMethods.Get, HttpMethods.Head], ServeAttachmentAsync).AllowAnonymous();
        app.MapMethods("/media/signature/{userName}", [HttpMethods.Get, HttpMethods.Head], ServeSignatureAsync).AllowAnonymous();
        app.MapMethods("/photo/{fileName}", [HttpMethods.Get, HttpMethods.Head], ServePhotoAsync).AllowAnonymous();

        app.MapGet("/api/Media/Token", (MediaAccess access, HttpContext context) =>
        {
            var (token, expiresAt) = access.IssuePhotoToken();
            context.Response.Headers.CacheControl = "no-store";
            return Results.Json(new { token, expiresAt, param = MediaAccess.PhotoTokenParam });
        }).RequireAuthorization("FileManagementApi");

        return app;
    }

    // ───────────────────────────── پیوست‌ها ─────────────────────────────

    private static async Task ServeAttachmentAsync(HttpContext context, string path,
        SignedFileUrl signer, FileStorageLocations locations, ImageThumbnailService thumbnails, MediaResponses responses)
    {
        long expiresAt = DateTimeOffset.UtcNow.AddMinutes(5).ToUnixTimeSeconds();
        if (signer.Enforced && !signer.IsValid(context.Request.Path,
                context.Request.Query[SignedFileUrl.ExpiresParam], context.Request.Query[SignedFileUrl.SignatureParam], out expiresAt))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }

        var physical = locations.ResolvePublicRelative(path);
        if (physical == null)
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        // محتوای هر مسیر هرگز عوض نمی‌شود (نام فایل GUID است) → کش تا پایان اعتبار آدرس
        var maxAge = Math.Clamp(HmacSigner.Remaining(expiresAt), 0, 24 * 3600);
        var cache = $"private, max-age={maxAge}, immutable";
        var fileName = Path.GetFileName(physical);

        if (MediaResponses.TryReadWidth(context.Request, out var width) && ImageThumbnailService.IsResizable(fileName))
        {
            var rendition = await thumbnails.GetAsync(physical, width, MediaResponses.ReadQuality(context.Request, 80),
                ImageThumbnailService.AcceptsWebp(context.Request), context.RequestAborted);
            if (rendition != null)
            {
                responses.ApplySecurityHeaders(context.Response, rendition.PhysicalPath, fileName, false, rendition.ContentType);
                await MediaResponses.SendRenditionAsync(context, rendition, cache);
                return;
            }
        }

        var contentType = responses.ContentTypeFor(fileName);
        var download = context.Request.Query.ContainsKey("download");
        responses.ApplySecurityHeaders(context.Response, fileName, null, download, contentType);
        await MediaResponses.SendFileAsync(context, physical, contentType, cache);
    }

    // ───────────────────────────── امضا ─────────────────────────────

    private static async Task ServeSignatureAsync(HttpContext context, string userName,
        MediaAccess access, FileStorageLocations locations, ImageThumbnailService thumbnails, MediaResponses responses)
    {
        if (!FileStorageLocations.IsSafeName(userName)
            || !access.IsValidSignatureUrl(userName, context.Request.Query["exp"], context.Request.Query["sig"], out var expiresAt))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }

        var physical = locations.FindSignature(userName);
        if (physical == null)
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        // فقط در حافظه‌ی همین مرورگر و تا پایان اعتبار آدرس؛ هیچ پراکسی/CDN نگه نمی‌دارد
        var cache = $"private, max-age={Math.Clamp(HmacSigner.Remaining(expiresAt), 0, 3600)}";
        var width = MediaResponses.TryReadWidth(context.Request, out var w) ? w : 640;
        var rendition = await thumbnails.GetAsync(physical, width, MediaResponses.ReadQuality(context.Request, 90),
            ImageThumbnailService.AcceptsWebp(context.Request), context.RequestAborted);

        if (rendition != null)
        {
            responses.ApplySecurityHeaders(context.Response, rendition.PhysicalPath, "signature", false, rendition.ContentType);
            await MediaResponses.SendRenditionAsync(context, rendition, cache);
            return;
        }

        var contentType = responses.ContentTypeFor(physical);
        responses.ApplySecurityHeaders(context.Response, physical, "signature", false, contentType);
        await MediaResponses.SendFileAsync(context, physical, contentType, cache);
    }

    // ───────────────────────────── عکس پرسنلی ─────────────────────────────

    private static Task ServePhotoAsync(HttpContext context, string fileName,
        MediaAccess access, FileStorageLocations locations, ImageThumbnailService thumbnails, MediaResponses responses)
        => ServePhotoCoreAsync(context, fileName, null, access, locations, thumbnails, responses);

    /// <summary>منطق مشترک /photo/… و api/Image (کنترلر)</summary>
    public static async Task ServePhotoCoreAsync(HttpContext context, string fileName, int? requestedWidth,
        MediaAccess access, FileStorageLocations locations, ImageThumbnailService thumbnails, MediaResponses responses)
    {
        if (!access.CanViewPhoto(context, out var maxAge))
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        var physical = locations.FindPhoto(fileName);
        if (physical == null)
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            context.Response.Headers.CacheControl = "private, max-age=600"; // آواتار پیش‌فرض فرانت؛ درخواست تکراری نفرستد
            return;
        }

        var cache = $"private, max-age={maxAge}";
        var width = requestedWidth ?? (MediaResponses.TryReadWidth(context.Request, out var w) ? w : 256);
        var rendition = await thumbnails.GetAsync(physical, width, MediaResponses.ReadQuality(context.Request, 80),
            ImageThumbnailService.AcceptsWebp(context.Request), context.RequestAborted);

        if (rendition != null)
        {
            responses.ApplySecurityHeaders(context.Response, rendition.PhysicalPath, "photo", false, rendition.ContentType);
            await MediaResponses.SendRenditionAsync(context, rendition, cache);
            return;
        }

        var contentType = responses.ContentTypeFor(physical);
        responses.ApplySecurityHeaders(context.Response, physical, "photo", false, contentType);
        await MediaResponses.SendFileAsync(context, physical, contentType, cache);
    }
}
