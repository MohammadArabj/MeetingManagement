using System.Globalization;
using System.Linq.Expressions;
using System.Net;
using Epc.Company.Query;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.Extensions.Configuration;
using Newtonsoft.Json;
using RestSharp;

namespace MeetingManagement.Common.Extensions;

public class IpInfo
{
    [JsonProperty("ip")]
    public string Ip { get; set; }

    [JsonProperty("hostname")]
    public string Hostname { get; set; }

    [JsonProperty("city")]
    public string City { get; set; }

    [JsonProperty("region")]
    public string Region { get; set; }

    [JsonProperty("country")]
    public string Country { get; set; }

    [JsonProperty("loc")]
    public string Loc { get; set; }

    [JsonProperty("org")]
    public string Org { get; set; }

    [JsonProperty("postal")]
    public string Postal { get; set; }
}

public static class ExtensionMethods
{
    public static async Task<Result<Guid>> UploadFileAsync(this IFormFile file,string systemGuid, string folderPath,string token, IConfiguration configuration)
    {
        var fileManagementUrl = $"{configuration["FileManagementUrl"]}/api/Attachment";
        var client = new RestClient(fileManagementUrl);
        var request = new RestRequest("UploadFile", Method.Post)
        {
            AlwaysMultipartFormData = true
        };
        //request.AddHeader("Accept", "application/json");
        //request.AddHeader("Content-Type", "application/json");
        request.AddHeader("Authorization", token); // اضافه کردن Bearer به توکن
        request.AddParameter("SystemGuid", systemGuid);
        request.AddParameter("FolderPath", folderPath);
        // استفاده از داده‌های بایتی فایل
        using (var stream = new MemoryStream())
        {
            await file.CopyToAsync(stream);
            request.AddFile("File", stream.ToArray(), file.FileName, file.ContentType);
        }

        try
        {
            // ارسال درخواست
            var response = await client.ExecuteAsync<UploadResult>(request);

            // بررسی نتیجه
            if (!response.IsSuccessful || response.Data == null)
            {
                return Result<Guid>.Failure(Guid.Empty, "File upload failed.");
            }

            // اگر آپلود موفق بود، GUID فایل را برمی‌گردانیم
            return Result<Guid>.Success(response.Data.Guid);
        }
        catch (Exception e)
        {
            Console.WriteLine(e);
            throw;
        }
        
    }
    public static async Task<Result<List<Guid>>> UploadFilesAsync(this List<IFormFile> files, string systemGuid, string folderPath, string token, IConfiguration configuration)
    {
        var fileManagementUrl = $"{configuration["FileManagementUrl"]}/api/Attachment";
        var client = new RestClient(fileManagementUrl);
        var request = new RestRequest("UploadFiles", Method.Post)
        {
            AlwaysMultipartFormData = true
        };
        //request.AddHeader("Accept", "application/json");
        //request.AddHeader("Content-Type", "application/json");
        request.AddHeader("Authorization", token); // اضافه کردن Bearer به توکن
        request.AddParameter("SystemGuid", systemGuid);
        request.AddParameter("FolderPath", folderPath);

        foreach (var file in files)
        {
            using var stream = new MemoryStream();
            await file.CopyToAsync(stream);
            request.AddFile("Files", stream.ToArray(), file.FileName, file.ContentType);
        }
     

        try
        {
            // ارسال درخواست
            var response = await client.ExecuteAsync<List<UploadResult>>(request);

            // بررسی نتیجه
            if (!response.IsSuccessful || response.Data == null)
            {
                return Result<List<Guid>>.Failure([], "File upload failed.");
            }

            // اگر آپلود موفق بود، GUID فایل را برمی‌گردانیم
            return Result<List<Guid>>.Success(response.Data.Select(c=>c.Guid).ToList());
        }
        catch (Exception e)
        {
            Console.WriteLine(e);
            throw;
        }

    }
    public static async Task<Result<bool>> DeleteFileAsync(this Guid guid, string token, IConfiguration configuration)
    {
        var fileManagementUrl = $"{configuration["FileManagementUrl"]}/api/Attachment";
        var client = new RestClient(fileManagementUrl);
        var request = new RestRequest($"Delete/{guid}", Method.Post);

        request.AddHeader("Authorization", token);

        try
        {
            var response = await client.ExecuteAsync<Result<bool>>(request); // نوع درست برگشتی

            if (!response.IsSuccessful || response.Data == null)
            {
                return Result<bool>.Failure(false, "File delete failed.");
            }

            return response.Data; // همون Result<bool> از سمت API
        }
        catch (Exception e)
        {
            Console.WriteLine(e);
            throw;
        }
    }
    public static async Task<Result<List<FileDetailsDto>>> GetFileDetails(this List<Guid> guids,string token, IConfiguration configuration)
    {
        var fileManagementUrl = $"{configuration["FileManagementUrl"]}/api/Attachment";
        var client = new RestClient(fileManagementUrl);
        var request = new RestRequest("GetFilesDetails", Method.Post);
        request.AddHeader("Authorization", token);

        // Add guids as a parameter
        request.AddJsonBody(guids); // ✅ فقط آرایه می‌فرسته: [ "guid1", "guid2" ]

        try
        {
            // ارسال درخواست
            var response = await client.ExecuteAsync<List<FileDetailsDto>>(request);

            // بررسی نتیجه
            if (!response.IsSuccessful || response.Data == null)
            {
                return Result<List<FileDetailsDto>>.Failure([], "File upload failed.");
            }



            return Result<List<FileDetailsDto>>.Success(response.Data);
        }
        catch (Exception e)
        {
            Console.WriteLine(e);
            throw;
        }
    }

    public static async Task<Result<bool>> SendMessage(this List<string> numbers, string message, IConfiguration configuration)
    {
        var fileManagementUrl = $"{configuration["SmsUrl"]}/api/SmsApi";
        var client = new RestClient(fileManagementUrl);
        var request = new RestRequest($"SendGroupSms", Method.Post);

        // اضافه کردن داده‌های مورد نیاز به درخواست
        request.AddJsonBody(new
        {
            Numbers = numbers,
            Message = message
        });

        try
        {
            var response = await client.ExecuteAsync<Result<bool>>(request);
            if (!response.IsSuccessful || response.Data == null)
            {
                return Result<bool>.Failure(false, "SMS sending failed.");
            }
            return response.Data;
        }
        catch (Exception e)
        {
            Console.WriteLine(e);
            throw;
        }
    }
    public static string GetUserCountryByIp(string ip)
    {
        IpInfo ipInfo = new IpInfo();
        try
        {
            string info = new WebClient().DownloadString("http://ipinfo.io/" + ip);
            ipInfo = JsonConvert.DeserializeObject<IpInfo>(info);
            var myRI1 = new RegionInfo(ipInfo.Country);
            ipInfo.Country = myRI1.EnglishName;
        }
        catch (Exception)
        {
            ipInfo.Country = null;
        }

        return ipInfo.Country;
    }

    public static IEnumerable<SelectListItem> ToSelectList<T>(this List<T> list, string Value = "Value", string Text = "Text", string selected = null)
        where T : class, new()
    {
        var selectListItems = new List<SelectListItem>();

        list.ForEach(item =>
        {
            selectListItems.Add(new SelectListItem
            {
                Text = item.GetType().GetProperty(Text).GetValue(item).ToString(),
                Value = item.GetType().GetProperty(Value).GetValue(item).ToString(),
                Selected = selected == item.GetType().GetProperty(Value).GetValue(item).ToString()
            });
        });

        return selectListItems.AsEnumerable();
    }

    public static IEnumerable<SelectListItem> ToSelectListNullable<T>(this List<T> list, string Value = "Value", string Text = "Text", string selected = null)
        where T : class, new()
    {
        var selectListItems = new List<SelectListItem>();

        list.ForEach(item =>
        {
            selectListItems.Add(new SelectListItem
            {
                Text = item.GetType().GetProperty(Text).GetValue(item).ToString(),
                Value = item.GetType().GetProperty(Value).GetValue(item).ToString(),
                Selected = selected == item.GetType().GetProperty(Value).GetValue(item).ToString()
            });
        });

        selectListItems.Add(new SelectListItem
        {
            Value = "",
            Selected = selected == null,
            Text = "-- انتخاب کنید --"
        });

        return selectListItems.OrderBy(x => x.Value).AsEnumerable();
    }

    public static string GetFileExtension(this string fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
        {
            return "";
        }

        string ext = string.Empty;
        int fileExtPos = fileName.LastIndexOf(".", StringComparison.Ordinal);
        if (fileExtPos >= 0)
            ext = fileName.Substring(fileExtPos, fileName.Length - fileExtPos);

        return ext;
    }

    public static string GetFileName(this string fileName)
    {
        string ext = string.Empty;
        int fileExtPos = fileName.LastIndexOf(".", StringComparison.Ordinal);
        if (fileExtPos >= 0)
            ext = fileName.Substring(0, fileExtPos);

        return ext;
    }

    public static string getBetween(string strSource, string strStart, string strEnd)
    {
        if (strSource.Contains(strStart) && strSource.Contains(strEnd))
        {
            int Start, End;
            Start = strSource.IndexOf(strStart, 0) + strStart.Length;
            End = strSource.IndexOf(strEnd, Start);
            return strSource.Substring(Start, End - Start);
        }

        return "";
    }

    //linq extensions
    public static IQueryable<TSource> WhereIf<TSource>(this IQueryable<TSource> source, bool condition,
        Expression<Func<TSource, bool>> predicate)
    {
        return condition ? source.Where(predicate) : source;
    }

    public static IEnumerable<TSource> WhereIf<TSource>(this IEnumerable<TSource> source, bool condition,
        Func<TSource, bool> predicate)
    {
        return condition ? source.Where(predicate) : source;
    }

    public static IEnumerable<T> DistinctBy<T, TKey>(this IEnumerable<T> items, Func<T, TKey> property)
    {
        return items.GroupBy(property).Select(x => x.First());
    }

    public static IEnumerable<T> DistinctByIf<T, TKey>(this IEnumerable<T> items, bool condition, Func<T, TKey> property)
    {
        return condition ? items.GroupBy(property).Select(x => x.First()) : items;
    }

    public static IQueryable<T> DistinctByIf<T, TKey>(this IQueryable<T> items, bool condition, Func<T, TKey> property)
    {
        return condition ? items.GroupBy(property).Select(x => x.First()).AsQueryable() : items;
    }

    public static string ToApiKey(this long s, string apiKey)
    {
        if (s == 0) return "-1";
        if (string.IsNullOrEmpty(apiKey)) return "-2";
        if (apiKey.Trim().Length < 4) return "-3";

        var random1 = apiKey.Substring(0, 2);
        var random2 = apiKey.Substring(2);
        return random1 + s + random2;
    }

    public static string ToApiKey(this int s, string apiKey)
    {
        if (s == 0) return "-1";
        if (string.IsNullOrEmpty(apiKey)) return "-2";
        if (apiKey.Trim().Length < 4) return "-3";

        var random1 = apiKey.Substring(0, 2);
        var random2 = apiKey.Substring(2);
        return random1 + s + random2;
    }

    public static long ToId(this string s)
    {
        if (string.IsNullOrEmpty(s)) return 0;
        if (s.Length < 5) return 0;
        s = s.Remove(s.Length - 2);
        return Convert.ToInt64(s.Substring(2));
    }


    public static string ToPersianNumber(this object s)
    {
        if (s == null) return "";
        return s.ToString().Replace("0", "۰")
            .Replace("1", "۱")
            .Replace("2", "۲")
            .Replace("3", "۳")
            .Replace("4", "۴")
            .Replace("5", "۵")
            .Replace("6", "۶")
            .Replace("7", "۷")
            .Replace("8", "۸")
            .Replace("9", "۹");
    }
    public static string ToEnglishNumber(this object s)
    {
        if (s == null) return "";
        return s.ToString().Replace("۰", "0")
            .Replace("۱", "1")
            .Replace("۲", "2")
            .Replace("۳", "3")
            .Replace("۴", "4")
            .Replace("۵", "5")
            .Replace("۶", "6")
            .Replace("۷", "7")
            .Replace("۸", "8")
            .Replace("۹", "9");
    }

    public static int ToInt(this object s)
    {
        if (s == null)
            return 0;

        var date = s.ToString();
        if (string.IsNullOrEmpty(date))
            return 0;

        bool valid = int.TryParse(date.RemoveComma(), out int result);
        return (valid) ? result : 0;
    }
    public static int? ToNullableInt(this object s)
    {

        if (s == null)
            return null;

        var date = s.ToString();
        if (string.IsNullOrEmpty(date))
            return null;

        bool valid = int.TryParse(date.RemoveComma(), out int result);
        return (valid) ? result : null;
    }

    public static long ToLong(this object s)
    {

        if (s == null)
            return 0;

        var date = s.ToString();
        if (string.IsNullOrEmpty(date))
            return 0;

        bool valid = long.TryParse(date.RemoveComma(), out long result);
        return (valid) ? result : 0;
    }
    public static double ToDouble(this object s)
    {

        if (s == null)
            return 0;

        var date = s.ToString();
        if (string.IsNullOrEmpty(date))
            return 0;

        bool valid = double.TryParse(date.RemoveComma(), out double result);
        return (valid) ? result : 0;
    }
    public static long? ToNullableLong(this object s)
    {

        if (s == null)
            return null;

        var date = s.ToString();
        if (string.IsNullOrEmpty(date))
            return null;

        bool valid = long.TryParse(date.RemoveComma(), out long result);
        return (valid) ? result : null;
    }

    public static byte ToByte(this object s)
    {

        if (s == null)
            return 0;

        var date = s.ToString();
        if (string.IsNullOrEmpty(date))
            return 0;

        bool valid = byte.TryParse(date.RemoveComma(), out byte result);
        return (valid) ? result : (byte)0;
    }
    public static byte? ToNullableByte(this object s)
    {

        if (s == null)
            return null;

        var date = s.ToString();
        if (string.IsNullOrEmpty(date))
            return null;

        bool valid = byte.TryParse(date.RemoveComma(), out byte result);
        return (valid) ? result : null;
    }

    public static string ToToman(this decimal s)
    {
        if (s == 0)
            return "";

        var date = s.ToString();
        if (string.IsNullOrEmpty(date))
            return "";

        return (s / 10).ToString("n0");
    }

    public static long ToRial(this object s)
    {
        if (s == null)
            return 0;

        var data = s.ToString();
        if (string.IsNullOrEmpty(data))
            return 0;

        return data.RemoveComma().ToLong() * 10;
    }
    public static long? ToNullableRial(this object s)
    {
        if (s == null)
            return null;

        var data = s.ToString();
        if (string.IsNullOrEmpty(data))
            return null;

        return data.RemoveComma().ToLong() * 10;
    }

    public static string RemoveComma(this string s)
    {
        if (string.IsNullOrEmpty(s))
            return "";

        return s.Replace(",", "").Replace("-", "");
    }

    /// <summary>
    /// شمارش کلمات یک عبارت
    /// </summary>
    /// <param name="Sentence">عبارت</param>
    /// <returns>تعداد کلمات</returns>
    public static int CalcWordCount(this string Sentence)
    {
        char[] delimiters = new char[] { ' ', '\r', '\n' };
        int count = string.IsNullOrWhiteSpace(Sentence) ? 0 : Sentence.Split(delimiters, StringSplitOptions.RemoveEmptyEntries).Length;
        return count;
    }

    public static string GenerateNumber(int requestType, int lastRequestNumber)
    {
           
        var year = DateTime.Now.Year.ToString("D4");
        var nextRequestNumber = lastRequestNumber + 1;
        var requestNumber = $"{year}-{requestType:D2}-{nextRequestNumber:D4}";
        return requestNumber;
    }

}