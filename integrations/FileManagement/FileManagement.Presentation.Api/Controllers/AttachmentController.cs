using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using FileManagement.Infrastructure.Query.Contracts.Attachment;
using FileManagement.Presentation.Facade.Contracts.Attachment;
using Microsoft.AspNetCore.Authorization;
using FileManagement.Common;
using FileManagement.Presentation.Api.Media;
using FileManagement.Presentation.Api.Security;
using Microsoft.AspNetCore.Mvc;

namespace FileManagement.Presentation.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "FileManagementApi")]
public class AttachmentController(
    IAttachmentCommandFacade attachmentCommandFacade,
    IAttachmentQueryFacade attachmentQueryFacade,
    FileStorageLocations locations,
    SignedFileUrl signedFileUrl,
    ImageThumbnailService thumbnails,
    MediaResponses responses)
    : ControllerBase
{
    [HttpGet("GetList")]
    public async Task<IActionResult> GetAll([FromQuery] AttachmentSearchModel searchModel)
        => new JsonResult(await attachmentQueryFacade.GetList(searchModel));

    [HttpGet("GetForOtherSystems")]
    public async Task<IActionResult> GetForOtherSystems([FromQuery] OtherSystemAttachmentSearchModel searchModel)
    {
        var items = await attachmentQueryFacade.GetForOtherSystems(searchModel);
        foreach (var item in items)
            item.Path = ToPublicPath(item.Path);
        return new JsonResult(items);
    }

    [HttpGet("GetFileName/{guid:guid}")]
    public async Task<IActionResult> GetFileName(Guid guid)
        => new JsonResult(await attachmentQueryFacade.GetFileNameBy(guid));

    // -----------------------------
    // Download / Preview (Bearer) — با Range، ETag و 304
    // -----------------------------
    [HttpGet("Download/{guid:guid}")]
    public async Task<IActionResult> Download(Guid guid)
    {
        var info = await attachmentQueryFacade.Download(guid);
        var physical = info == null ? null : locations.ResolveStoredFile(info.Path);
        if (info == null || physical == null)
            return NotFound(new { message = "فایل یافت نشد", guid });

        var contentType = SafeContentType(info.ContentType, info.FileName);
        responses.ApplySecurityHeaders(Response, info.FileName, info.FileName, forceDownload: true, contentType);
        Response.Headers.CacheControl = "private, max-age=3600";
        var file = new FileInfo(physical);
        return PhysicalFile(physical, contentType, new DateTimeOffset(file.LastWriteTimeUtc), MediaResponses.ETagFor(file), enableRangeProcessing: true);
    }

    /// <summary>نمایش داخل صفحه؛ برای تصاویر با w نسخه‌ی کوچک‌شده (WebP/JPEG) برگردانده می‌شود</summary>
    [HttpGet("Preview/{guid:guid}")]
    public async Task<IActionResult> Preview(Guid guid, [FromQuery] int? w)
    {
        var info = await attachmentQueryFacade.Download(guid);
        var physical = info == null ? null : locations.ResolveStoredFile(info.Path);
        if (info == null || physical == null)
            return NotFound(new { message = "فایل یافت نشد", guid });

        Response.Headers.CacheControl = "private, max-age=3600";

        if (w is > 0 && ImageThumbnailService.IsResizable(physical))
        {
            var rendition = await thumbnails.GetAsync(physical, w.Value, 80, ImageThumbnailService.AcceptsWebp(Request), HttpContext.RequestAborted);
            if (rendition != null)
            {
                Response.Headers.Append("Vary", "Accept");
                responses.ApplySecurityHeaders(Response, rendition.PhysicalPath, info.FileName, false, rendition.ContentType);
                return PhysicalFile(rendition.PhysicalPath, rendition.ContentType, rendition.LastModified,
                    new Microsoft.Net.Http.Headers.EntityTagHeaderValue(rendition.ETag));
            }
        }

        var contentType = SafeContentType(info.ContentType, info.FileName);
        responses.ApplySecurityHeaders(Response, info.FileName, info.FileName, forceDownload: false, contentType);
        var file = new FileInfo(physical);
        return PhysicalFile(physical, contentType, new DateTimeOffset(file.LastWriteTimeUtc), MediaResponses.ETagFor(file), enableRangeProcessing: true);
    }

    // -----------------------------
    // Meta
    // -----------------------------
    [HttpGet("GetMeta/{guid:guid}")]
    public async Task<IActionResult> GetMeta(Guid guid)
    {
        var result = await attachmentQueryFacade.GetMeta(guid);
        if (result == null) return NotFound();

        var publicPath = ToPublicPath(result.Path);
        var dto = result with { Path = publicPath ?? string.Empty };
        return new JsonResult(dto);
    }

    [HttpPost("GetMetas")]
    public async Task<IActionResult> GetMetas([FromBody] List<Guid> guids)
    {
        if (guids == null || guids.Count == 0)
            return BadRequest(new { message = "لیست شناسه‌ها خالی است" });

        var result = await attachmentQueryFacade.GetMetas(guids);
        var mapped = result.Select(x => x with { Path = ToPublicPath(x.Path) ?? string.Empty }).ToList();
        return new JsonResult(mapped);
    }

    // =====================================================================
    // ✅ DELETE ENDPOINTS (Single + Bulk) - fully compatible with your frontend
    // =====================================================================

    // 1) POST /api/Attachment/Delete/{guid}
    [HttpPost("Delete/{guid:guid}")]
    public async Task<IActionResult> Delete_Post(Guid guid)
        => new JsonResult(await attachmentCommandFacade.Delete(guid));

    // 2) DELETE /api/Attachment/Delete/{guid}
    [HttpDelete("Delete/{guid:guid}")]
    public async Task<IActionResult> Delete_Delete(Guid guid)
        => new JsonResult(await attachmentCommandFacade.Delete(guid));

    // 3) POST /api/Attachment/Remove/{guid}
    [HttpPost("Remove/{guid:guid}")]
    public async Task<IActionResult> Remove_Post(Guid guid)
        => new JsonResult(await attachmentCommandFacade.Delete(guid));

    // 4) DELETE /api/Attachment/{guid}
    [HttpDelete("{guid:guid}")]
    public async Task<IActionResult> Delete_Root(Guid guid)
        => new JsonResult(await attachmentCommandFacade.Delete(guid));

    // 5) ✅ POST /api/Attachment/Delete  Body: [guid1,guid2,...]
    [HttpPost("Delete")]
    public async Task<IActionResult> DeleteMany([FromBody] List<Guid> guids)
    {
        if (guids == null || guids.Count == 0)
            return BadRequest(new { message = "لیست شناسه‌ها خالی است" });

        return new JsonResult(await attachmentCommandFacade.DeleteMany(guids));
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    /// <summary>نوع محتوا از روی پسوند (نه مقدار اعلام‌شده توسط کلاینت هنگام آپلود)</summary>
    private string SafeContentType(string? stored, string fileName) => responses.ContentTypeFor(fileName);

    /// <summary>مسیر ذخیره‌شده → آدرس عمومی امضاشده (/files/…?exp&amp;sig)</summary>
    private string? ToPublicPath(string? storedPath)
    {
        var relative = locations.ToRelativePath(storedPath);
        return relative == null ? null : signedFileUrl.Sign("/files/" + relative);
    }
}
