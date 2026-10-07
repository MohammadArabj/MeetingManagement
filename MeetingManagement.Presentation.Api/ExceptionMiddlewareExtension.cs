using System.Net;
using Epc.Core.Exceptions;
using Microsoft.AspNetCore.Diagnostics;

namespace MeetingManagement.Presentation.Api;

public static class ExceptionMiddlewareExtension
{
    /// <summary>کد وضعیت خطاهای کاربرپسند (فرانت متن پاسخ را مستقیم نمایش می‌دهد)</summary>
    public const int UserControlledErrorCode = 410;

    public static void ConfigureExceptionHandler(this IApplicationBuilder app)
    {
        app.UseExceptionHandler(appError =>
        {
            appError.Run(async context =>
            {
                var error = context.Features.Get<IExceptionHandlerFeature>()?.Error;
                var logger = context.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("UnhandledException");

                context.Response.ContentType = "text/plain; charset=utf-8";

                switch (error)
                {
                    case BusinessException:
                        // ✅ قبلاً error.ToString() (همراه Stack Trace) برای کاربر ارسال می‌شد
                        context.Response.StatusCode = UserControlledErrorCode;
                        await context.Response.WriteAsync(string.IsNullOrWhiteSpace(error.Message)
                            ? "اطلاعات وارد شده معتبر نیست."
                            : error.Message);
                        return;

                    case InvalidOperationException ioe when ioe.Source?.StartsWith("MeetingManagement") == true:
                        context.Response.StatusCode = UserControlledErrorCode;
                        await context.Response.WriteAsync(ioe.Message);
                        return;
                }

                var inner = error?.InnerException?.Message ?? string.Empty;
                if (inner.Contains("DELETE statement conflicted") || inner.Contains("REFERENCE constraint"))
                {
                    context.Response.StatusCode = UserControlledErrorCode;
                    await context.Response.WriteAsync("ردیف مورد نظر در سایر قسمت‌ها استفاده شده است.");
                    return;
                }

                logger.LogError(error, "Unhandled exception on {Method} {Path}", context.Request.Method, context.Request.Path);
                context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
                // ✅ قبلاً برای خطاهای دارای InnerException بدنه خالی برمی‌گشت
                await context.Response.WriteAsync($"خطایی رخ داده است. کد پیگیری: {context.TraceIdentifier}");
            });
        });
    }
}
