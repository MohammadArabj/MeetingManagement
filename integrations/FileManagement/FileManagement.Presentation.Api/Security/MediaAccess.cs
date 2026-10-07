using System.Globalization;

namespace FileManagement.Presentation.Api.Security;

/// <summary>
/// کنترل دسترسی به تصاویر پرسنلی و تصاویر امضا.
/// ─────────────────────────────────────────────────────────────────────────
/// امضا:  فقط با آدرس امضاشده‌ای که سامانه‌ی صاحب فرایند (مثلاً مدیریت جلسات) پس از بررسی دسترسی
///         صادر می‌کند:  /media/signature/{userName}?exp=…&amp;sig=…
///         sig = HMAC-SHA256(FileSettings:SignatureUrlKey, "signature|{userName}|{exp}")  (Base64Url)
///         بدون کلید، تصاویر امضا اصلاً در دسترس نیستند (fail-closed).
///
/// عکس:   با توکن کوتاه‌مدت «mt» که هر کاربر واردشده از  GET api/Media/Token  می‌گیرد (یا SSO با همان کلید
///         می‌سازد): mt = "{exp}.{HMAC(FileSettings:PhotoTokenKey, "photo|{exp}")}". توکن برای همه‌ی کاربران
///         در یک بازه یکسان است تا آدرس عکس‌ها ثابت بماند و از کش مرورگر خوانده شوند.
/// </summary>
public sealed class MediaAccess
{
    public const string PhotoTokenParam = "mt";

    private readonly HmacSigner _signatureSigner;
    private readonly HmacSigner _photoSigner;
    private readonly TimeSpan _photoLifetime;
    private readonly TimeSpan _photoBucket;

    public MediaAccess(IConfiguration configuration, ILogger<MediaAccess> logger)
    {
        _signatureSigner = new HmacSigner(configuration["FileSettings:SignatureUrlKey"], false, logger, "FileSettings:SignatureUrlKey");
        if (!_signatureSigner.IsConfigured)
            logger.LogWarning("FileSettings:SignatureUrlKey is not set; signature images are not served.");

        _photoSigner = new HmacSigner(configuration["FileSettings:PhotoTokenKey"], true, logger, "FileSettings:PhotoTokenKey");
        _photoLifetime = TimeSpan.FromHours(Math.Clamp(configuration.GetValue("FileSettings:PhotoTokenLifetimeHours", 12), 1, 72));
        _photoBucket = TimeSpan.FromHours(1);
        AllowAnonymousPhotos = configuration.GetValue("FileSettings:AllowAnonymousPhotos", false);
    }

    /// <summary>دوره‌ی گذار: عکس‌ها بدون توکن هم سرو شوند (برای سامانه‌هایی که هنوز به‌روز نشده‌اند)</summary>
    public bool AllowAnonymousPhotos { get; }

    public bool SignaturesEnabled => _signatureSigner.IsConfigured;

    // ─────────────── امضا ───────────────

    public static string SignaturePayload(string userName, long exp)
        => $"signature|{userName.ToLowerInvariant()}|{exp.ToString(CultureInfo.InvariantCulture)}";

    public bool IsValidSignatureUrl(string userName, string? exp, string? sig, out long expiresAt)
    {
        expiresAt = 0;
        if (!SignaturesEnabled) return false;
        if (!long.TryParse(exp, NumberStyles.None, CultureInfo.InvariantCulture, out expiresAt)) return false;
        var remaining = HmacSigner.Remaining(expiresAt);
        if (remaining <= 0 || remaining > TimeSpan.FromDays(2).TotalSeconds) return false;
        return _signatureSigner.Verify(SignaturePayload(userName, expiresAt), sig);
    }

    // ─────────────── عکس ───────────────

    public (string Token, DateTimeOffset ExpiresAt) IssuePhotoToken()
    {
        var exp = HmacSigner.BucketedExpiry(_photoLifetime, _photoBucket);
        return ($"{exp}.{_photoSigner.Compute($"photo|{exp}")}", DateTimeOffset.FromUnixTimeSeconds(exp));
    }

    public bool IsValidPhotoToken(string? token, out long expiresAt)
    {
        expiresAt = 0;
        if (string.IsNullOrEmpty(token) || token.Length > 160) return false;
        var dot = token.IndexOf('.');
        if (dot <= 0) return false;
        if (!long.TryParse(token.AsSpan(0, dot), NumberStyles.None, CultureInfo.InvariantCulture, out expiresAt)) return false;
        var remaining = HmacSigner.Remaining(expiresAt);
        if (remaining <= 0 || remaining > TimeSpan.FromDays(4).TotalSeconds) return false;
        return _photoSigner.Verify($"photo|{expiresAt}", token[(dot + 1)..]);
    }

    /// <summary>
    /// اجازه‌ی دیدن عکس: کاربر واردشده (Bearer)، توکن mt معتبر، یا حالت گذار.
    /// خروجی maxAge: حداکثر زمان مجاز کش در مرورگر (ثانیه)
    /// </summary>
    public bool CanViewPhoto(HttpContext context, out long maxAge)
    {
        if (IsValidPhotoToken(context.Request.Query[PhotoTokenParam], out var exp))
        {
            maxAge = Math.Clamp(HmacSigner.Remaining(exp), 0, 6 * 3600);
            return true;
        }

        maxAge = 3600;
        return context.User.Identity?.IsAuthenticated == true || AllowAnonymousPhotos;
    }
}
