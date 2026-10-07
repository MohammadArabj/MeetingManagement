using FileManagement.Common;
using FileManagement.Presentation.Api.Media;
using FileManagement.Presentation.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FileManagement.Presentation.Api.Controllers;

/// <summary>عکس پرسنلی با Bearer (برای فراخوانی‌های HttpClient)؛ برای تگ img از /photo/… با توکن mt استفاده کنید.</summary>
[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "FileManagementApi")]
public class PhotoController(
    MediaAccess access,
    FileStorageLocations locations,
    ImageThumbnailService thumbnails,
    MediaResponses responses) : ControllerBase
{
    /// <summary>عکس خود کاربر (claim نام کاربری/شماره پرسنلی)</summary>
    [HttpGet("Me")]
    public async Task Me([FromQuery] int? w)
    {
        var name = User.FindFirst("personal_no")?.Value
                   ?? User.FindFirst("preferred_username")?.Value
                   ?? User.FindFirst("name")?.Value;
        if (!FileStorageLocations.IsSafeName(name))
        {
            Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        await MediaEndpoints.ServePhotoCoreAsync(HttpContext, name!, w, access, locations, thumbnails, responses);
    }

    [HttpGet("{personalNo}")]
    public Task ByPersonalNo(string personalNo, [FromQuery] int? w)
        => MediaEndpoints.ServePhotoCoreAsync(HttpContext, personalNo, w, access, locations, thumbnails, responses);
}
