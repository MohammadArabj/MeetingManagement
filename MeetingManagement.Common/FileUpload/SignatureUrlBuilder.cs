using System;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;

namespace MeetingManagement.Common.FileUpload;

/// <summary>
/// آدرس موقت و امضاشده‌ی تصویر امضای کاربر در سامانه‌ی مدیریت فایل.
/// ─────────────────────────────────────────────────────────────────────────
/// تصویر امضا دیگر با آدرس ثابت و عمومی (/EpcSignature/{user}.jpg) در دسترس نیست. فقط این سرور،
/// پس از بررسی دسترسی کاربر به جلسه/صورتجلسه، آدرسی با اعتبار محدود صادر می‌کند:
///   /media/signature/{userName}?exp={unix}&amp;sig={HMAC-SHA256("signature|{userName}|{exp}")}
/// کلید مشترک: FileManagement:SignatureUrlKey (همان FileSettings:SignatureUrlKey در سامانه‌ی مدیریت فایل).
/// انقضا پله‌ای است تا آدرس در طول یک بازه ثابت بماند و مرورگر تصویر را از کش بخواند.
/// </summary>
public sealed class SignatureUrlBuilder
{
    private readonly byte[]? _key;
    private readonly long _lifetimeSeconds;
    private readonly long _bucketSeconds;

    public SignatureUrlBuilder(IConfiguration configuration)
    {
        var key = configuration["FileManagement:SignatureUrlKey"];
        _key = string.IsNullOrWhiteSpace(key) ? null : Encoding.UTF8.GetBytes(key);

        var minutes = int.TryParse(configuration["FileManagement:SignatureUrlLifetimeMinutes"], out var m) ? m : 60;
        minutes = Math.Clamp(minutes, 10, 24 * 60);
        _lifetimeSeconds = minutes * 60L;
        _bucketSeconds = Math.Max(300, _lifetimeSeconds / 3);
    }

    public bool IsConfigured => _key != null;

    /// <summary>مسیر نسبی (فرانت آن را به fileManagementEndpoint می‌چسباند)؛ بدون کلید یا نام نامعتبر null</summary>
    public string? Build(string? userName)
    {
        if (_key == null || !IsSafeUserName(userName)) return null;

        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var exp = now - now % _bucketSeconds + _lifetimeSeconds;
        var payload = $"signature|{userName!.ToLowerInvariant()}|{exp.ToString(CultureInfo.InvariantCulture)}";

        using var hmac = new HMACSHA256(_key);
        var sig = Base64Url(hmac.ComputeHash(Encoding.UTF8.GetBytes(payload)));
        return $"/media/signature/{Uri.EscapeDataString(userName)}?exp={exp}&sig={sig}";
    }

    private static bool IsSafeUserName(string? userName)
    {
        if (string.IsNullOrWhiteSpace(userName) || userName.Length > 128) return false;
        if (!char.IsAsciiLetterOrDigit(userName[0]) || userName.Trim('0').Length == 0) return false; // «0000» = بدون کاربر
        foreach (var c in userName)
            if (!(char.IsAsciiLetterOrDigit(c) || c is '.' or '_' or '-')) return false;
        return true;
    }

    private static string Base64Url(byte[] bytes)
        => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
