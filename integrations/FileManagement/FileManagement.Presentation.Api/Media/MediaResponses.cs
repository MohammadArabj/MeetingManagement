using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Net.Http.Headers;

namespace FileManagement.Presentation.Api.Media;

/// <summary>تنظیمات مشترک پاسخ فایل‌ها (نوع محتوا، هدرهای امنیتی، کش و درخواست شرطی)</summary>
public sealed class MediaResponses
{
    /// <summary>انواعی که مرورگر می‌تواند به‌عنوان صفحه/اسکریپت اجرا کند؛ هرگز inline روی دامنه‌ی فایل اجرا نشوند</summary>
    private static readonly HashSet<string> ActiveExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".html", ".htm", ".xhtml", ".shtml", ".svg", ".svgz", ".xml", ".xsl", ".xslt", ".js", ".mjs", ".swf", ".hta", ".mht", ".mhtml"
    };

    private readonly FileExtensionContentTypeProvider _types = new();

    public MediaResponses(string frameAncestors)
    {
        FrameAncestors = frameAncestors;
        _types.Mappings[".webp"] = "image/webp";
        _types.Mappings[".csv"] = "text/csv";
        _types.Mappings[".json"] = "application/json";
        _types.Mappings[".rar"] = "application/vnd.rar";
        _types.Mappings[".7z"] = "application/x-7z-compressed";
        _types.Mappings[".dwg"] = "application/acad";
        _types.Mappings[".msg"] = "application/vnd.ms-outlook";
    }

    /// <summary>مبداهایی که اجازه دارند فایل را در iframe نمایش دهند (CSP frame-ancestors)</summary>
    public string FrameAncestors { get; }

    public string ContentTypeFor(string fileName)
        => _types.TryGetContentType(fileName, out var type) ? type : "application/octet-stream";

    public static bool IsActiveContent(string fileName) => ActiveExtensions.Contains(Path.GetExtension(fileName));

    /// <summary>
    /// هدرهای امنیتی پاسخ فایل.
    /// محتوای فعال (HTML/SVG/XML/JS) همیشه دانلودی و داخل sandbox است تا XSS ذخیره‌شده ممکن نباشد.
    /// </summary>
    public void ApplySecurityHeaders(HttpResponse response, string fileName, string? downloadName, bool forceDownload, string contentType)
    {
        var headers = response.Headers;
        headers.XContentTypeOptions = "nosniff";
        headers["Referrer-Policy"] = "no-referrer";
        headers["Cross-Origin-Resource-Policy"] = "cross-origin";
        headers.Remove(HeaderNames.XFrameOptions);

        var active = IsActiveContent(fileName);
        headers.ContentSecurityPolicy = active
            ? "sandbox; default-src 'none'; frame-ancestors 'none'"
            : $"frame-ancestors {FrameAncestors}"; // نمایشگر PDF مرورگر با CSP سخت‌گیرانه‌تر از کار می‌افتد؛ nosniff کافی است

        var download = forceDownload || active || contentType == "application/octet-stream";
        var name = downloadName ?? Path.GetFileName(fileName);
        headers.ContentDisposition = $"{(download ? "attachment" : "inline")}; filename*=UTF-8''{Uri.EscapeDataString(name)}";
    }

    public static EntityTagHeaderValue ETagFor(FileInfo file)
        => new($"\"{file.LastWriteTimeUtc.Ticks:x}-{file.Length:x}\"");

    /// <summary>ارسال فایل با پشتیبانی Range (پخش ویدئو/PDF بزرگ)، ETag و If-None-Match/If-Modified-Since</summary>
    public static Task SendFileAsync(HttpContext context, string physicalPath, string contentType, string cacheControl,
        EntityTagHeaderValue? etag = null, DateTimeOffset? lastModified = null)
    {
        var info = new FileInfo(physicalPath);
        context.Response.Headers.CacheControl = cacheControl;
        return Results.File(
                physicalPath,
                contentType,
                fileDownloadName: null,
                lastModified: lastModified ?? new DateTimeOffset(info.LastWriteTimeUtc),
                entityTag: etag ?? ETagFor(info),
                enableRangeProcessing: true)
            .ExecuteAsync(context);
    }

    public static Task SendRenditionAsync(HttpContext context, ImageRendition rendition, string cacheControl)
    {
        context.Response.Headers.Append(HeaderNames.Vary, "Accept");
        return SendFileAsync(context, rendition.PhysicalPath, rendition.ContentType, cacheControl,
            new EntityTagHeaderValue(rendition.ETag), rendition.LastModified);
    }

    public static bool TryReadWidth(HttpRequest request, out int width)
    {
        width = 0;
        var raw = request.Query["w"].ToString();
        return raw.Length is > 0 and < 6 && int.TryParse(raw, out width) && width > 0;
    }

    public static int ReadQuality(HttpRequest request, int fallback)
        => int.TryParse(request.Query["q"], out var q) ? Math.Clamp(q, 40, 95) : fallback;
}
