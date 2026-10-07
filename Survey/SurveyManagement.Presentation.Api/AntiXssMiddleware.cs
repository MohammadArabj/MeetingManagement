using System.Net;
using System.Text;
using Newtonsoft.Json;

namespace SurveyManagement.Presentation.Api;

/// <summary>
/// فیلتر ساده‌ی ورودی‌های حاوی تگ خطرناک (لایه‌ی دفاعی دوم؛ لایه‌ی اصلی Encode خروجی Razor است).
/// اصلاحات:
///  • فقط بدنه‌های JSON و فرم (urlencoded) بررسی می‌شوند. قبلاً هر بدنه‌ای (از جمله فایل‌های آپلودی و
///    باینری) کامل در حافظه کپی و به رشته تبدیل می‌شد؛ هم کند و پرمصرف بود و هم فایل‌هایی که اتفاقاً
///    بایت‌های «&lt;html» داشتند با 400 رد می‌شدند.
///  • سقف اندازه (۱ مگابایت؛ فرم نظرسنجی با سوال‌های زیاد) و EnableBuffering به جای کپی دستی Stream.
///  • بدنه‌ی فرم URL-decode می‌شود و مقایسه حساس به حروف کوچک/بزرگ نیست (قبلاً &lt;SCRIPT&gt; یا
///    %3Cscript%3E عبور می‌کرد).
/// </summary>
public class AntiXssMiddleware
{
    private const int MaxInspectedBodyBytes = 1024 * 1024;
    private static readonly string ErrorJson = new ErrorResponse
    {
        Description = "Error from AntiXssMiddleware",
        ErrorCode = 500
    }.ToJSON();

    private readonly RequestDelegate _next;

    public AntiXssMiddleware(RequestDelegate next)
    {
        _next = next ?? throw new ArgumentNullException(nameof(next));
    }

    public async Task Invoke(HttpContext context)
    {
        var request = context.Request;

        if (CrossSiteScriptingValidation.IsDangerousString(WebUtility.UrlDecode(request.Path.Value ?? string.Empty), out _) ||
            CrossSiteScriptingValidation.IsDangerousString(WebUtility.UrlDecode(request.QueryString.Value ?? string.Empty), out _))
        {
            await RespondWithAnError(context).ConfigureAwait(false);
            return;
        }

        if (ShouldInspectBody(request))
        {
            var content = await ReadRequestBody(request).ConfigureAwait(false);
            if (content is not null && CrossSiteScriptingValidation.IsDangerousString(content, out _))
            {
                await RespondWithAnError(context).ConfigureAwait(false);
                return;
            }
        }

        await _next(context).ConfigureAwait(false);
    }

    private static bool ShouldInspectBody(HttpRequest request)
    {
        if (HttpMethods.IsGet(request.Method) || HttpMethods.IsHead(request.Method) || HttpMethods.IsOptions(request.Method))
            return false;
        if (request.ContentLength is 0) return false;

        var type = request.ContentType ?? string.Empty;
        return type.StartsWith("application/json", StringComparison.OrdinalIgnoreCase)
               || type.StartsWith("application/x-www-form-urlencoded", StringComparison.OrdinalIgnoreCase)
               || type.StartsWith("text/", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>بدنه تا سقف مشخص؛ بزرگ‌تر از سقف بررسی نمی‌شود (null)</summary>
    private static async Task<string?> ReadRequestBody(HttpRequest request)
    {
        if (request.ContentLength > MaxInspectedBodyBytes) return null;

        request.EnableBuffering(MaxInspectedBodyBytes);
        var buffer = new byte[MaxInspectedBodyBytes + 1];
        var read = 0;
        int n;
        while (read < buffer.Length &&
               (n = await request.Body.ReadAsync(buffer.AsMemory(read, buffer.Length - read)).ConfigureAwait(false)) > 0)
            read += n;
        request.Body.Position = 0;

        if (read > MaxInspectedBodyBytes) return null;

        var text = Encoding.UTF8.GetString(buffer, 0, read);
        return (request.ContentType ?? string.Empty).StartsWith("application/x-www-form-urlencoded", StringComparison.OrdinalIgnoreCase)
            ? WebUtility.UrlDecode(text)
            : text;
    }

    private static async Task RespondWithAnError(HttpContext context)
    {
        context.Response.Clear();
        context.Response.Headers.AddHeaders();
        context.Response.ContentType = "application/json; charset=utf-8";
        context.Response.StatusCode = (int)HttpStatusCode.BadRequest;
        await context.Response.WriteAsync(ErrorJson);
    }
}

public static class AntiXssMiddlewareExtension
{
    public static IApplicationBuilder UseAntiXssMiddleware(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<AntiXssMiddleware>();
    }
}

public static class CrossSiteScriptingValidation
{
    private static readonly string[] DangerousTags = ["<script", "<html", "<css", "<php", "<iframe", "<object", "<embed"];

    #region Public methods

    public static bool IsDangerousString(string s, out int matchIndex)
    {
        //bool inComment = false;
        matchIndex = 0;

        if (string.IsNullOrEmpty(s)) return false;

        foreach (var tag in DangerousTags)
        {
            var index = s.IndexOf(tag, StringComparison.OrdinalIgnoreCase);
            if (index >= 0)
            {
                matchIndex = index;
                return true;
            }
        }

        // JSON escape شده‌ی «<» (\u003c) هم بررسی می‌شود
        if (s.Contains("\\u003c", StringComparison.OrdinalIgnoreCase) &&
            IsDangerousString(System.Text.RegularExpressions.Regex.Replace(s, @"\\u003c", "<", System.Text.RegularExpressions.RegexOptions.IgnoreCase), out matchIndex))
            return true;

        return false;
    }

    #endregion

    public static void AddHeaders(this IHeaderDictionary headers)
    {
        if (headers["P3P"].IsNullOrEmpty())
        {
            headers.Add("P3P", "CP=\"IDC DSP COR ADM DEVi TAIi PSA PSD IVAi IVDi CONi HIS OUR IND CNT\"");
        }
    }

    public static bool IsNullOrEmpty<T>(this IEnumerable<T> source)
    {
        return source == null || !source.Any();
    }
    public static string ToJSON(this object value)
    {
        return JsonConvert.SerializeObject(value);
    }
}

public class ErrorResponse
{
    public int ErrorCode { get; set; }
    public string Description { get; set; } = string.Empty;
}
