using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using FileManagement.Infrastructure.Query.Contracts.Attachment;
using FileManagement.Presentation.Facade.Contracts.Attachment;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;

namespace FileManagement.Presentation.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "FileManagementApi")]
public class AttachmentController(
    IAttachmentCommandFacade attachmentCommandFacade,
    IAttachmentQueryFacade attachmentQueryFacade,
    IWebHostEnvironment webHostEnvironment,
    IConfiguration configuration,
    FileManagement.Presentation.Api.Security.SignedFileUrl signedFileUrl)
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
    // Download
    // -----------------------------
    [HttpGet("Download/{guid:guid}")]
    public async Task<IActionResult> Download(Guid guid)
    {
        var info = await attachmentQueryFacade.Download(guid);
        if (info == null)
            return NotFound(new { message = "فایل یافت نشد", guid });

        var physicalPath = ToPhysicalPath(info.Path);
        if (string.IsNullOrEmpty(physicalPath))
            return NotFound(new { message = "مسیر فیزیکی نامعتبر", guid, info.Path });

        if (!System.IO.File.Exists(physicalPath))
            return NotFound(new { message = "فایل در سرور یافت نشد", guid, info.Path, physicalPath });

        var stream = new FileStream(physicalPath, FileMode.Open, FileAccess.Read, FileShare.Read);
        return File(stream, info.ContentType, info.FileName, enableRangeProcessing: true);
    }

    // -----------------------------
    // Preview
    // -----------------------------
    [HttpGet("Preview/{guid:guid}")]
    public async Task<IActionResult> Preview(Guid guid)
    {
        var info = await attachmentQueryFacade.Download(guid);
        if (info == null) return NotFound();

        var physicalPath = ToPhysicalPath(info.Path);
        if (string.IsNullOrEmpty(physicalPath) || !System.IO.File.Exists(physicalPath))
            return NotFound();

        Response.Headers["Content-Disposition"] =
            $"inline; filename*=UTF-8''{Uri.EscapeDataString(info.FileName)}";

        var stream = new FileStream(physicalPath, FileMode.Open, FileAccess.Read, FileShare.Read);
        return File(stream, info.ContentType, enableRangeProcessing: true);
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
    private string? ToPhysicalPath(string? storedPath)
    {
        if (string.IsNullOrWhiteSpace(storedPath))
            return null;

        var basePathFromConfig = configuration["FileSettings:FileBasePath"];
        var contentRoot = webHostEnvironment.ContentRootPath ?? Directory.GetCurrentDirectory();

        var basePath = string.IsNullOrWhiteSpace(basePathFromConfig)
            ? Path.Combine(contentRoot, "files")
            : basePathFromConfig;

        if (!Path.IsPathRooted(basePath))
            basePath = Path.GetFullPath(Path.Combine(contentRoot, basePath));

        basePath = Path.GetFullPath(basePath);

        var basePathWithSep =
            basePath.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;

        string candidateFullPath;

        if (Path.IsPathRooted(storedPath))
        {
            candidateFullPath = Path.GetFullPath(storedPath);
        }
        else
        {
            var normalized = storedPath.Replace('\\', '/').TrimStart('/');
            var baseFolderName = new DirectoryInfo(basePath).Name; // "files"
            if (normalized.StartsWith(baseFolderName + "/", StringComparison.OrdinalIgnoreCase))
                normalized = normalized.Substring(baseFolderName.Length + 1);

            candidateFullPath = Path.GetFullPath(Path.Combine(basePath, normalized));
        }

        if (!candidateFullPath.StartsWith(basePathWithSep, StringComparison.OrdinalIgnoreCase))
            return null;

        return candidateFullPath;
    }

    private string? ToPublicPath(string? storedPath)
    {
        if (string.IsNullOrWhiteSpace(storedPath))
            return null;

        var basePathFromConfig = configuration["FileSettings:FileBasePath"];
        var contentRoot = webHostEnvironment.ContentRootPath ?? Directory.GetCurrentDirectory();

        var basePath = string.IsNullOrWhiteSpace(basePathFromConfig)
            ? Path.Combine(contentRoot, "files")
            : basePathFromConfig;

        if (!Path.IsPathRooted(basePath))
            basePath = Path.GetFullPath(Path.Combine(contentRoot, basePath));

        basePath = Path.GetFullPath(basePath);

        if (Path.IsPathRooted(storedPath))
        {
            var full = Path.GetFullPath(storedPath);
            var rel = Path.GetRelativePath(basePath, full).Replace('\\', '/');
            rel = rel.TrimStart('.').TrimStart('/');
            return signedFileUrl.Sign("/files/" + rel);
        }

        var normalized = storedPath.Replace('\\', '/').TrimStart('/');
        var baseFolderName = new DirectoryInfo(basePath).Name; // "files"
        if (normalized.StartsWith(baseFolderName + "/", StringComparison.OrdinalIgnoreCase))
            normalized = normalized.Substring(baseFolderName.Length + 1);

        return signedFileUrl.Sign("/files/" + normalized);
    }
}
