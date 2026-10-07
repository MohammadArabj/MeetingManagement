using System;
using System.IO;
using System.Net.Http.Headers;
using Microsoft.AspNetCore.Http;

namespace MeetingManagement.Application.Contracts.UploadFile;

public static class FileManager
{
    public static Guid Upload(this IFormFile file)
    {
        var fileContent = ContentDispositionHeaderValue.Parse(file.ContentDisposition);

        // Some browsers send file names with full path.
        // We are only interested in the file name.
        var newName = Guid.NewGuid().ToString().Replace(" ", "").Replace("-", "").Substring(0, 16) + Path.GetExtension(file.FileName);

        var fileName = newName;
        var physicalPath = Path.Combine(Directory.GetCurrentDirectory(), "Media/Profiles", fileName);

        // The files are not actually saved in this demo
        using var fileStream = new FileStream(physicalPath, FileMode.Create);
        file.CopyTo(fileStream);
        return new Guid();
    }
    
}

