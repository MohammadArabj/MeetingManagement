using EPC.SSO.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;

namespace EPC.SSO.Quickstart.Documents;

/// <summary>
/// مستندات سامانه‌ها (کاج). فقط کاربران واردشده و فقط زیرمجموعه‌ی پوشه‌ی ریشه.
/// </summary>
[Authorize]
[SecurityHeaders]
public class DocumentsController(KaajDocumentApiService kaajDocumentApiService) : Controller
{
    private static readonly FileExtensionContentTypeProvider ContentTypes = new();

    /// <summary>فقط این نوع‌ها inline نمایش داده می‌شوند؛ بقیه (از جمله SVG/HTML) همیشه دانلود می‌شوند</summary>
    private static readonly HashSet<string> InlineTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp", "application/pdf"
    };

    [HttpGet]
    public IActionResult Index()
    {
        ViewData["RootFolderUuid"] = kaajDocumentApiService.GetRootFolderUuid();
        return View();
    }

    [HttpGet]
    public async Task<IActionResult> Browse(string? folderUuid)
    {
        if (string.IsNullOrWhiteSpace(folderUuid))
            folderUuid = kaajDocumentApiService.GetRootFolderUuid();
        else if (!await kaajDocumentApiService.IsFolderInScopeAsync(folderUuid))
            return NotFound();

        var foldersTask = kaajDocumentApiService.GetFoldersAsync(folderUuid);
        var documentsTask = kaajDocumentApiService.GetDocumentsAsync(folderUuid);
        await Task.WhenAll(foldersTask, documentsTask);

        var folders = (await foldersTask)
            .OrderBy(f => f.Name, StringComparer.CurrentCultureIgnoreCase)
            .Select(f => new
            {
                f.Uuid,
                f.Name,
                f.HasChildren,
                created = f.Created?.ToString("yyyy/MM/dd"),
            });

        var documents = (await documentsTask)
            .OrderBy(d => d.Name, StringComparer.CurrentCultureIgnoreCase)
            .Select(d => new
            {
                d.Uuid,
                d.Name,
                d.MimeType,
                d.Size,
                d.IsImage,
                d.IsPdf,
                created = d.Created?.ToString("yyyy/MM/dd"),
            });

        return Json(new { folders, documents });
    }

    /// <param name="mimeType">نادیده گرفته می‌شود (سازگاری با نسخه‌ی قبلی کلاینت)؛ نوع فایل از اطلاعات خود سند خوانده می‌شود</param>
    [HttpGet]
    public async Task<IActionResult> Download(string docUuid, bool inline = false, string? mimeType = null)
    {
        if (string.IsNullOrWhiteSpace(docUuid))
            return NotFound();

        var document = await kaajDocumentApiService.GetDocumentInScopeAsync(docUuid);
        if (document == null)
            return NotFound();

        var ct = HttpContext.RequestAborted;
        var (response, detectedContentType, fileName) = await kaajDocumentApiService.OpenDocumentAsync(docUuid, ct);
        if (response is null)
            return NotFound();
        Response.RegisterForDispose(response);

        if (!string.IsNullOrWhiteSpace(document.Name)) fileName = document.Name;

        // سرویس کاج گاهی Content-Type درست برنمی‌گرداند (مثلاً octet-stream برای PDF)؛
        // ترتیب: نوع ثبت‌شده در کاج ← نوع پاسخ دانلود ← پسوند فایل
        var contentType = FirstSpecific(document.MimeType, detectedContentType)
                          ?? (ContentTypes.TryGetContentType(fileName, out var byExt) ? byExt : "application/octet-stream");

        var isInline = inline && InlineTypes.Contains(contentType);
        if (!isInline && !InlineTypes.Contains(contentType))
            contentType = "application/octet-stream";

        var encodedName = Uri.EscapeDataString(fileName);
        Response.Headers["Content-Disposition"] = isInline
            ? $"inline; filename*=UTF-8''{encodedName}"
            : $"attachment; filename*=UTF-8''{encodedName}";
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        // محتوای مخزن اسناد هرگز نباید در مبدأ SSO اسکریپت اجرا کند (PDF: نمایشگر مرورگر، بدون CSP)
        if (contentType != "application/pdf")
            Response.Headers["Content-Security-Policy"] = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox";

        var length = response.Content.Headers.ContentLength;
        if (length.HasValue) Response.ContentLength = length;

        var stream = await response.Content.ReadAsStreamAsync(ct);
        return File(stream, contentType, enableRangeProcessing: false);
    }

    private static string? FirstSpecific(params string?[] types) =>
        types.FirstOrDefault(t => !string.IsNullOrWhiteSpace(t)
                                  && !t.Equals("application/octet-stream", StringComparison.OrdinalIgnoreCase)
                                  && !t.Equals("binary/octet-stream", StringComparison.OrdinalIgnoreCase));
}
