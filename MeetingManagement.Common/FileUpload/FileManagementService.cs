using Epc.Company.Query;
using MeetingManagement.Common.Extensions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using RestSharp;

namespace MeetingManagement.Common.FileUpload;
public class FileManagementService
{
    private readonly string _fileManagementUrl;
    private readonly RestClient _client;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IConfiguration _configuration;

    public FileManagementService(IConfiguration configuration, IHttpContextAccessor httpContextAccessor)
    {
        _fileManagementUrl = $"{configuration["FileManagementUrl"]}/api/Attachment";
        _client = new RestClient(_fileManagementUrl);
        _configuration = configuration;
        _httpContextAccessor = httpContextAccessor;
    }

    private RestRequest CreateRequest(string endpoint, Method method = Method.Post, Dictionary<string, string> additionalHeaders = null, Dictionary<string, string> parameters = null)
    {
        // دریافت توکن و سیستم GUID از هدرهای درخواست
        var token = _httpContextAccessor.HttpContext.Request.Headers["Authorization"].ToString();
        var systemGuid = _httpContextAccessor.HttpContext.Request.Headers["client-id"].ToString();

        // بررسی موجود بودن توکن و systemGuid
        if (string.IsNullOrEmpty(token) || string.IsNullOrEmpty(systemGuid))
        {
            throw new UnauthorizedAccessException("Authorization token or System GUID is missing.");
        }

        // ساخت درخواست جدید
        var request = new RestRequest(endpoint, method)
        {
            AlwaysMultipartFormData = true
        };

        // اضافه کردن هدرهای عمومی
        request.AddHeader("Authorization", token);

        // اضافه کردن پارامتر سیستم
        request.AddParameter("SystemGuid", systemGuid);

        // اضافه کردن هدرهای اضافی (در صورت وجود)
        if (additionalHeaders != null)
        {
            foreach (var header in additionalHeaders)
            {
                request.AddHeader(header.Key, header.Value);
            }
        }

        // اضافه کردن پارامترهای اضافی به درخواست (در صورت وجود)
        if (parameters != null)
        {
            foreach (var parameter in parameters)
            {
                request.AddParameter(parameter.Key, parameter.Value);
            }
        }

        return request;
    }


    // آپلود فایل
    public async Task<Result<Guid>> UploadFileAsync(IFormFile file, string folderPath)
    {
        var request = CreateRequest("UploadFile");
        request.AddParameter("FolderPath", folderPath);

        using (var stream = new MemoryStream())
        {
            await file.CopyToAsync(stream);
            request.AddFile("File", stream.ToArray(), file.FileName, file.ContentType);
        }

        try
        {
            var response = await _client.ExecuteAsync<UploadResult>(request);

            if (!response.IsSuccessful || response.Data == null)
            {
                return Result<Guid>.Failure(Guid.Empty, "File upload failed.");
            }

            return Result<Guid>.Success(response.Data.Guid);
        }
        catch (Exception e)
        {
            Console.WriteLine(e);
            return Result<Guid>.Failure(Guid.Empty, "An error occurred during the upload process.");
        }
    }

    // آپلود چندین فایل
    public async Task<Result<List<Guid>>> UploadFilesAsync(List<IFormFile> files, string systemGuid, string folderPath)
    {
        var request = CreateRequest("UploadFiles");
        request.AddParameter("FolderPath", folderPath);

        foreach (var file in files)
        {
            using var stream = new MemoryStream();
            await file.CopyToAsync(stream);
            request.AddFile("Files", stream.ToArray(), file.FileName, file.ContentType);
        }

        try
        {
            var response = await _client.ExecuteAsync<List<UploadResult>>(request);

            if (!response.IsSuccessful || response.Data == null)
            {
                return Result<List<Guid>>.Failure([], "File upload failed.");
            }

            return Result<List<Guid>>.Success(response.Data.Select(c => c.Guid).ToList());
        }
        catch (Exception e)
        {
            Console.WriteLine(e);
            return Result<List<Guid>>.Failure([], "An error occurred during the upload process.");
        }
    }

    // حذف فایل
    public async Task<Result<bool>> DeleteFileAsync(Guid guid)
    {
        var endpoint = $"Delete/{guid}";

        // ساخت هدرهای اضافی (در صورت نیاز)
        var additionalHeaders = new Dictionary<string, string>
        {
            { "Authorization", _httpContextAccessor.HttpContext.Request.Headers["Authorization"].ToString() }
        };

        // ایجاد درخواست با استفاده از CreateRequest
        var request = CreateRequest(endpoint, Method.Post, additionalHeaders);

        try
        {
            // ارسال درخواست
            var client = new RestClient($"{_configuration["FileManagementUrl"]}/api/Attachment");
            var response = await client.ExecuteAsync<Result<bool>>(request);

            // بررسی نتیجه
            if (!response.IsSuccessful || response.Data == null)
            {
                return Result<bool>.Failure(false, "File deletion failed.");
            }

            return Result<bool>.Success(response.Data.Data);
        }
        catch (Exception e)
        {
            Console.WriteLine(e);
            return Result<bool>.Failure(false, "An error occurred during the deletion process.");
        }
    }
    // دانلود فایل
  
}


//public class UploadResult
//{
//    public Guid Guid { get; set; }
//}

//public class FileDownloadInfo
//{
//    public byte[] FileContent { get; set; }
//    public string FileName { get; set; }
//    public string ContentType { get; set; }
//}

//public class Result<T>
//{
//    public bool IsSuccess { get; private set; }
//    public T Data { get; private set; }
//    public string ErrorMessage { get; private set; }

//    private Result(bool isSuccess, T data, string errorMessage)
//    {
//        IsSuccess = isSuccess;
//        Data = data;
//        ErrorMessage = errorMessage;
//    }

//    public static Result<T> Success(T data) => new Result<T>(true, data, null);
//    public static Result<T> Failure(T data, string errorMessage) => new Result<T>(false, data, errorMessage);
//}
