using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace EPC.SSO.Infrastructure;

public static class RateLimitPolicies
{
    public const string Login = "login";
    public const string ForgotPassword = "forgot-password";
    public const string PublicDirectory = "public-directory";

    public static IServiceCollection AddSsoRateLimiting(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = async (context, token) =>
            {
                context.HttpContext.Response.ContentType = "text/plain; charset=utf-8";
                await context.HttpContext.Response.WriteAsync("تعداد درخواست‌ها بیش از حد مجاز است. لطفاً چند دقیقه بعد تلاش کنید.", token);
            };

            // ورود: ۲۰ تلاش در دقیقه برای هر IP (برای ۱۰۰ کاربر هم‌زمان کاملاً کافی است)
            options.AddPolicy(Login, http => RateLimitPartition.GetFixedWindowLimiter(
                http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));

            // فراموشی رمز: ۵ درخواست در ۱۵ دقیقه برای هر IP
            options.AddPolicy(ForgotPassword, http => RateLimitPartition.GetFixedWindowLimiter(
                http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(15), QueueLimit = 0 }));

            // دفترچه تلفن (بدون ورود): جستجو و عکس‌ها؛ برای یک صفحه با اسکرول کافی، برای سوءاستفاده کم
            options.AddPolicy(PublicDirectory, http => RateLimitPartition.GetSlidingWindowLimiter(
                http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new SlidingWindowRateLimiterOptions { PermitLimit = 600, Window = TimeSpan.FromMinutes(1), SegmentsPerWindow = 6, QueueLimit = 0 }));
        });

        return services;
    }
}
