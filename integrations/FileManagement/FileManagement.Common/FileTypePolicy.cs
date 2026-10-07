using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

namespace FileManagement.Common;

/// <summary>
/// سیاست نوع فایل‌های قابل آپلود (یک مرجع برای tus و تکمیل آپلود).
///  • پسوندهای اجرایی/اسکریپتی همیشه ممنوع‌اند.
///  • اگر FileSettings:FileExtensions تنظیم شده باشد، فقط همان پسوندها مجازند.
/// </summary>
public sealed class FileTypePolicy
{
    private static readonly Regex TusId = new(@"^[A-Za-z0-9_\-]{8,64}$", RegexOptions.Compiled);

    private static readonly string[] AlwaysBlocked =
    [
        ".exe", ".dll", ".bat", ".cmd", ".ps1", ".psm1", ".sh", ".msi", ".msp", ".scr", ".com", ".cpl", ".msc",
        ".vbs", ".vbe", ".jse", ".wsf", ".wsh", ".hta", ".lnk", ".reg", ".jar", ".appx", ".application",
        ".php", ".phtml", ".asp", ".aspx", ".ashx", ".asmx", ".cshtml", ".jsp", ".cgi", ".pl", ".config"
    ];

    private readonly HashSet<string> _blocked;
    private readonly HashSet<string>? _allowed;

    public FileTypePolicy(IConfiguration configuration)
    {
        _blocked = new HashSet<string>(AlwaysBlocked, StringComparer.OrdinalIgnoreCase);
        foreach (var ext in configuration.GetSection("TusSettings:BlockedExtensions").GetChildren().Select(c => c.Value ?? string.Empty).Where(v => v.Length > 0))
            _blocked.Add(NormalizeExt(ext));

        var allowed = configuration["FileSettings:FileExtensions"];
        if (!string.IsNullOrWhiteSpace(allowed))
            _allowed = new HashSet<string>(
                allowed.Split([',', ';', ' '], StringSplitOptions.RemoveEmptyEntries).Select(NormalizeExt),
                StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>null یعنی مجاز؛ در غیر این صورت پیام خطا</summary>
    public string? Validate(string? fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName) || fileName.Length > 255 || fileName.Any(char.IsControl))
            return "نام فایل نامعتبر است.";

        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        if (_blocked.Contains(ext))
            return $"بارگذاری فایل با پسوند «{ext}» مجاز نیست.";
        if (_allowed != null && !_allowed.Contains(ext))
            return string.IsNullOrEmpty(ext) ? "فایل بدون پسوند قابل بارگذاری نیست." : $"پسوند «{ext}» در فهرست پسوندهای مجاز نیست.";
        return null;
    }

    /// <summary>شناسه‌ی tus فقط حروف/عدد است؛ جلوگیری از خواندن فایل دلخواه سرور با «../»</summary>
    public static bool IsValidTusId(string? id) => !string.IsNullOrEmpty(id) && TusId.IsMatch(id);

    private static string NormalizeExt(string ext)
    {
        var e = ext.Trim().ToLowerInvariant();
        return e.StartsWith('.') ? e : "." + e;
    }
}
