using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.WebUtilities;

namespace FileManagement.Presentation.Api.Security;

/// <summary>
/// امضای HMAC-SHA256 با انقضای «پله‌ای».
/// ─────────────────────────────────────────────────────────────────────────
/// زمان انقضا به ابتدای بازه‌ی جاری گرد می‌شود؛ بنابراین در طول یک بازه برای یک فایل همیشه همان آدرس
/// ساخته می‌شود و مرورگر می‌تواند فایل را از کش خودش بدهد (قبلاً هر بار آدرس تازه‌ای ساخته می‌شد و
/// هیچ تصویری کش نمی‌شد). مهلت باقی‌مانده هر آدرس همیشه حداقل «مهلت − طول بازه» است.
/// </summary>
public sealed class HmacSigner
{
    private readonly byte[] _key;

    public HmacSigner(string? key, bool required, ILogger logger, string name)
    {
        IsConfigured = !string.IsNullOrWhiteSpace(key);
        if (IsConfigured)
        {
            _key = Encoding.UTF8.GetBytes(key!);
        }
        else
        {
            // بدون کلید ثابت، با هر راه‌اندازی مجدد لینک‌های قبلی باطل می‌شوند و سامانه‌های دیگر نمی‌توانند لینک بسازند
            _key = RandomNumberGenerator.GetBytes(32);
            if (required) logger.LogWarning("{Name} is not set; a random key is used until the next restart.", name);
        }
    }

    public bool IsConfigured { get; }

    public static long BucketedExpiry(TimeSpan lifetime, TimeSpan bucket)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var size = Math.Max(60, (long)bucket.TotalSeconds);
        return now - now % size + (long)lifetime.TotalSeconds;
    }

    public string Compute(string payload)
    {
        using var hmac = new HMACSHA256(_key);
        return WebEncoders.Base64UrlEncode(hmac.ComputeHash(Encoding.UTF8.GetBytes(payload)));
    }

    public bool Verify(string payload, string? signature)
    {
        if (string.IsNullOrEmpty(signature) || signature.Length > 128) return false;
        return CryptographicOperations.FixedTimeEquals(
            Encoding.ASCII.GetBytes(Compute(payload)), Encoding.ASCII.GetBytes(signature));
    }

    /// <summary>ثانیه‌های باقی‌مانده تا انقضا (منفی = منقضی)</summary>
    public static long Remaining(long expiresAt) => expiresAt - DateTimeOffset.UtcNow.ToUnixTimeSeconds();
}

/// <summary>
/// آدرس امضاشده و موقت برای فایل‌های پیوست (/files/...).
/// مسیر فقط از API احرازهویت‌شده (GetMeta/GetMetas/...) با امضا برگردانده می‌شود و Middleware
/// هر درخواست بدون امضای معتبر را رد می‌کند. تگ‌های img/iframe/video بدون توکن کار می‌کنند چون
/// امضا در Query String است.
/// </summary>
public sealed class SignedFileUrl
{
    public const string ExpiresParam = "exp";
    public const string SignatureParam = "sig";

    private readonly HmacSigner _signer;
    private readonly TimeSpan _lifetime;
    private readonly TimeSpan _bucket;

    public bool Enforced { get; }

    public SignedFileUrl(IConfiguration configuration, ILogger<SignedFileUrl> logger)
    {
        _signer = new HmacSigner(configuration["FileSettings:UrlSigningKey"], true, logger, "FileSettings:UrlSigningKey");
        _lifetime = TimeSpan.FromMinutes(Math.Clamp(configuration.GetValue("FileSettings:UrlLifetimeMinutes", 180), 10, 24 * 60));
        // آدرس هر فایل در طول یک بازه ثابت می‌ماند (پیش‌فرض یک‌سوم مهلت)
        _bucket = TimeSpan.FromTicks(_lifetime.Ticks / 3);
        Enforced = configuration.GetValue("FileSettings:RequireSignedUrls", true);
    }

    /// <summary>افزودن امضا به مسیر عمومی (مثل /files/1404/a.pdf)</summary>
    public string Sign(string publicPath)
    {
        if (string.IsNullOrWhiteSpace(publicPath)) return publicPath;
        var path = Normalize(publicPath);
        var exp = HmacSigner.BucketedExpiry(_lifetime, _bucket);
        return $"{EncodePath(path)}?{ExpiresParam}={exp}&{SignatureParam}={_signer.Compute($"{path}|{exp}")}";
    }

    /// <summary>اعتبار امضا؛ در صورت معتبر بودن، زمان انقضا برگردانده می‌شود</summary>
    public bool IsValid(PathString path, string? exp, string? sig, out long expiresAt)
    {
        expiresAt = 0;
        if (!long.TryParse(exp, out expiresAt) || HmacSigner.Remaining(expiresAt) <= 0) return false;
        return _signer.Verify($"{Normalize(path.Value ?? string.Empty)}|{expiresAt}", sig);
    }

    /// <summary>مسیر با / شروع شود و حروف رمزگذاری‌شده‌ی URL یکسان مقایسه شوند</summary>
    private static string Normalize(string path)
    {
        var decoded = Uri.UnescapeDataString(path.Split('?')[0]).Replace('\\', '/');
        return decoded.StartsWith('/') ? decoded : "/" + decoded;
    }

    private static string EncodePath(string path)
        => string.Join('/', path.Split('/').Select(Uri.EscapeDataString));
}
