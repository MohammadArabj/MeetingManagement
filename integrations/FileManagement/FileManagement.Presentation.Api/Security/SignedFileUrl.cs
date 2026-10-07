using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.WebUtilities;

namespace FileManagement.Presentation.Api.Security;

/// <summary>
/// آدرس امضاشده و موقت برای فایل‌های ایستا (/files/...).
/// ─────────────────────────────────────────────────────────────────────────
/// قبلاً هر کسی که مسیر فایل را می‌دانست (حتی بدون ورود) می‌توانست آن را دانلود کند؛ مسیرها هم
/// شامل شماره جلسه و نام فایل و قابل حدس بودند. حالا مسیر فقط از API احرازهویت‌شده (GetMeta/GetMetas/...)
/// با امضای HMAC و تاریخ انقضا برگردانده می‌شود و Middleware هر درخواست بدون امضای معتبر را رد می‌کند.
/// تگ‌های img/iframe/video فرانت بدون تغییر کار می‌کنند چون امضا در Query String است.
/// </summary>
public sealed class SignedFileUrl
{
    public const string ExpiresParam = "exp";
    public const string SignatureParam = "sig";

    private readonly byte[] _key;
    private readonly TimeSpan _lifetime;

    public bool Enforced { get; }

    public SignedFileUrl(IConfiguration configuration, ILogger<SignedFileUrl> logger)
    {
        var key = configuration["FileSettings:UrlSigningKey"];
        if (string.IsNullOrWhiteSpace(key))
        {
            // بدون کلید ثابت، با هر راه‌اندازی مجدد لینک‌های قبلی باطل می‌شوند (در چند سرور باید کلید ثابت تنظیم شود)
            _key = RandomNumberGenerator.GetBytes(32);
            logger.LogWarning("FileSettings:UrlSigningKey is not set; a random key is used until the next restart.");
        }
        else
        {
            _key = Encoding.UTF8.GetBytes(key);
        }

        _lifetime = TimeSpan.FromMinutes(Math.Clamp(configuration.GetValue("FileSettings:UrlLifetimeMinutes", 120), 5, 24 * 60));
        Enforced = configuration.GetValue("FileSettings:RequireSignedUrls", true);
    }

    /// <summary>افزودن امضا به مسیر عمومی (مثل /files/1404/a.pdf)</summary>
    public string Sign(string publicPath)
    {
        if (string.IsNullOrWhiteSpace(publicPath)) return publicPath;
        var path = Normalize(publicPath);
        var exp = DateTimeOffset.UtcNow.Add(_lifetime).ToUnixTimeSeconds();
        return $"{path}?{ExpiresParam}={exp}&{SignatureParam}={Compute(path, exp)}";
    }

    public bool IsValid(PathString path, string? exp, string? sig)
    {
        if (!long.TryParse(exp, out var expiresAt) || string.IsNullOrEmpty(sig)) return false;
        if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() > expiresAt) return false;

        var expected = Compute(Normalize(path.Value ?? string.Empty), expiresAt);
        return CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(expected), Encoding.ASCII.GetBytes(sig));
    }

    private string Compute(string path, long exp)
    {
        using var hmac = new HMACSHA256(_key);
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes($"{path}|{exp}"));
        return WebEncoders.Base64UrlEncode(hash);
    }

    /// <summary>مسیر با / شروع شود و حروف رمزگذاری‌شده‌ی URL یکسان مقایسه شوند</summary>
    private static string Normalize(string path)
    {
        var decoded = Uri.UnescapeDataString(path.Split('?')[0]).Replace('\\', '/');
        return decoded.StartsWith('/') ? decoded : "/" + decoded;
    }
}

public static class SignedFileUrlMiddlewareExtensions
{
    /// <summary>فقط درخواست‌های دارای امضای معتبر به فایل‌های زیر <paramref name="requestPath"/> می‌رسند.</summary>
    public static IApplicationBuilder UseSignedFileUrls(this IApplicationBuilder app, string requestPath)
    {
        var signer = app.ApplicationServices.GetRequiredService<SignedFileUrl>();
        if (!signer.Enforced) return app;

        return app.Use(async (context, next) =>
        {
            if (context.Request.Path.StartsWithSegments(requestPath, StringComparison.OrdinalIgnoreCase)
                && !HttpMethods.IsOptions(context.Request.Method)
                && !signer.IsValid(context.Request.Path,
                    context.Request.Query[SignedFileUrl.ExpiresParam], context.Request.Query[SignedFileUrl.SignatureParam]))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return;
            }

            await next();
        });
    }
}
