using System.Net;
using Epc.Core.Exceptions;
using Microsoft.AspNetCore.Diagnostics;

namespace SurveyManagement.Presentation.Api;

public static class ExceptionMiddlewareExtension
{
    public const int UserControlledErrorCode = 410;

    public static void ConfigureExceptionHandler(this IApplicationBuilder app)
    {
        app.UseExceptionHandler(appError =>
        {
            appError.Run(async context =>
            {
                context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
                context.Response.ContentType = "application/json";
                var contextFeature = context.Features.Get<IExceptionHandlerFeature>();
                if (contextFeature != null)
                {
                    var error = contextFeature.Error;
                    if (error is MeetingManagement.Common.Extensions.InvalidDateException)
                    {
                        context.Response.StatusCode = UserControlledErrorCode;
                        await context.Response.WriteAsync(error.Message);
                    }
                    else if (error is BusinessException)
                    {
                        context.Response.StatusCode = UserControlledErrorCode;
                        // فقط پیام (قبلاً ToString کامل با Stack Trace به کاربر برمی‌گشت)
                        await context.Response.WriteAsync(error.Message);
                    }
                    else
                    {
                        if (error.InnerException is not null)
                        {
                            if (error.InnerException.Message.Contains("DELETE statement conflicted"))
                            {
                                context.Response.StatusCode = UserControlledErrorCode;
                                await context.Response.WriteAsync("ردیف مورد نظر در سایر قسمت ها استفاده شده است.");
                            }
                            else
                            {
                                // پیام خام SQL (نام جدول/ستون) به کاربر نشان داده نمی‌شود
                                await context.Response.WriteAsync("خطایی رخ داده است.");
                            }
                        }
                        else
                        {
                            await context.Response.WriteAsync("خطایی رخ داده است.");
                        }
                    }
                }
            });
        });
    }
}