using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

namespace FileManagement.Common;

/// <summary>
/// مسیرهای فیزیکی ذخیره‌سازی سامانه‌ی مدیریت فایل (یک مرجع واحد برای آپلود، دانلود، حذف، تصاویر و کش).
/// ─────────────────────────────────────────────────────────────────────────────────────────────
///  • Files       ← FileSettings:FileBasePath       (پیش‌فرض: files)               پیوست‌ها
///  • Photos      ← FileSettings:PhotoBasePath      (پیش‌فرض: App_Data/photos)     تصاویر پرسنلی
///  • Signatures  ← FileSettings:SignatureBasePath  (پیش‌فرض: App_Data/signatures) تصاویر امضا
///  • Cache       ← FileSettings:CachePath          (پیش‌فرض: App_Data/cache)      بندانگشتی‌ها
/// همه‌ی این پوشه‌ها خارج از wwwroot هستند و هیچ‌کدام مستقیم (Static) سرو نمی‌شوند.
/// برای سازگاری با استقرارهای قبلی، پوشه‌های قدیمی (wwwroot/photo و wwwroot/EpcSignature و files کنار برنامه)
/// به‌عنوان مسیر دوم (فقط خواندنی) جستجو می‌شوند تا جابه‌جایی فایل‌ها بدون قطعی انجام شود.
/// </summary>
public sealed class FileStorageLocations
{
    /// <summary>پیشوند ثابتی که در StoragePath پیوست‌ها ذخیره می‌شود (files/...)</summary>
    public const string StoredPrefix = "files";

    private static readonly Regex SafeName = new(@"^[A-Za-z0-9][A-Za-z0-9._\-]{0,127}$", RegexOptions.Compiled);
    private static readonly string[] ImageExtensions = [".jpg", ".jpeg", ".png", ".webp"];

    public string ContentRoot { get; }
    public string FilesRoot { get; }
    public string PhotosRoot { get; }
    public string SignaturesRoot { get; }
    public string CacheRoot { get; }

    /// <summary>مسیرهای جستجو (اول مسیر تنظیم‌شده، سپس مسیر قدیمی)</summary>
    public IReadOnlyList<string> FileRoots { get; }
    public IReadOnlyList<string> PhotoRoots { get; }
    public IReadOnlyList<string> SignatureRoots { get; }

    public FileStorageLocations(IConfiguration configuration)
    {
        ContentRoot = Path.GetFullPath(configuration["FileSettings:ContentRoot"] is { Length: > 0 } root
            ? root
            : Directory.GetCurrentDirectory());

        var webRoot = Path.Combine(ContentRoot, "wwwroot");

        FilesRoot = Resolve(configuration["FileSettings:FileBasePath"], StoredPrefix);
        PhotosRoot = Resolve(configuration["FileSettings:PhotoBasePath"], Path.Combine("App_Data", "photos"));
        SignaturesRoot = Resolve(configuration["FileSettings:SignatureBasePath"], Path.Combine("App_Data", "signatures"));
        CacheRoot = Resolve(configuration["FileSettings:CachePath"], Path.Combine("App_Data", "cache"));

        FileRoots = Distinct(FilesRoot, Path.Combine(ContentRoot, StoredPrefix));
        PhotoRoots = Distinct(PhotosRoot, Path.Combine(webRoot, "photo"));
        SignatureRoots = Distinct(SignaturesRoot, Path.Combine(webRoot, "EpcSignature"));

        Directory.CreateDirectory(FilesRoot);
        Directory.CreateDirectory(CacheRoot);
    }

    // ───────────────────────────── پیوست‌ها ─────────────────────────────

    /// <summary>
    /// مسیر ذخیره‌شده در پایگاه داده (files/… یا مسیر مطلق قدیمی) → مسیر فیزیکی موجود.
    /// فقط مسیرهای داخل پوشه‌های مجاز پذیرفته می‌شوند (جلوگیری از Path Traversal).
    /// </summary>
    public string? ResolveStoredFile(string? storedPath)
    {
        foreach (var candidate in CandidatesFor(storedPath))
            if (File.Exists(candidate)) return candidate;
        return null;
    }

    /// <summary>مسیر فیزیکی مورد انتظار (حتی اگر فایل وجود نداشته باشد)؛ برای سازگاری با IFilePathResolver</summary>
    public string? ExpectedPhysicalPath(string? storedPath) => CandidatesFor(storedPath).FirstOrDefault();

    /// <summary>مسیر نسبی داخل پوشه‌ی فایل‌ها (برای ساخت آدرس /files/…)</summary>
    public string? ToRelativePath(string? storedPath)
    {
        var physical = ResolveStoredFile(storedPath) ?? ExpectedPhysicalPath(storedPath);
        if (physical == null) return null;

        foreach (var root in FileRoots)
            if (IsUnder(physical, root))
                return Path.GetRelativePath(root, physical).Replace('\\', '/');
        return null;
    }

    /// <summary>مسیر فیزیکی آدرس عمومی /files/{relative} (هر دو ریشه جستجو می‌شود)</summary>
    public string? ResolvePublicRelative(string relative)
    {
        var normalized = Normalize(relative);
        if (normalized == null) return null;

        foreach (var root in FileRoots)
        {
            var full = Path.GetFullPath(Path.Combine(root, normalized));
            if (IsUnder(full, root) && File.Exists(full)) return full;
        }
        return null;
    }

    /// <summary>مسیر فیزیکی جدید برای ذخیره‌ی فایل + مقداری که در StoragePath ثبت می‌شود</summary>
    public (string PhysicalPath, string StoredPath) NewStoredFile(string relativeDirectory, string fileName)
    {
        var dir = Normalize(relativeDirectory) ?? throw new InvalidOperationException("Invalid storage directory.");
        var safeFile = Path.GetFileName(fileName);
        var physical = Path.GetFullPath(Path.Combine(FilesRoot, dir, safeFile));
        if (!IsUnder(physical, FilesRoot)) throw new InvalidOperationException("Invalid storage path.");

        Directory.CreateDirectory(Path.GetDirectoryName(physical)!);
        var stored = $"{StoredPrefix}/{Path.GetRelativePath(FilesRoot, physical).Replace('\\', '/')}";
        return (physical, stored);
    }

    // ───────────────────────────── تصاویر پرسنلی و امضا ─────────────────────────────

    public static bool IsSafeName(string? name) => !string.IsNullOrWhiteSpace(name) && SafeName.IsMatch(name);

    /// <summary>تصویر پرسنلی با نام کاربری/شماره پرسنلی (با یا بدون پسوند)</summary>
    public string? FindPhoto(string? name) => FindImage(PhotoRoots, name);

    /// <summary>تصویر امضای کاربر با نام کاربری</summary>
    public string? FindSignature(string? userName) => FindImage(SignatureRoots, userName);

    private static string? FindImage(IEnumerable<string> roots, string? name)
    {
        if (!IsSafeName(name)) return null;

        var ext = Path.GetExtension(name!).ToLowerInvariant();
        var hasImageExt = ImageExtensions.Contains(ext);
        var baseName = hasImageExt ? Path.GetFileNameWithoutExtension(name!) : name!;
        if (!IsSafeName(baseName)) return null;

        foreach (var root in roots)
        {
            if (!Directory.Exists(root)) continue;
            if (hasImageExt)
            {
                var exact = Path.Combine(root, baseName + ext);
                if (File.Exists(exact)) return exact;
            }
            foreach (var e in ImageExtensions)
            {
                var path = Path.Combine(root, baseName + e);
                if (File.Exists(path)) return path;
            }
        }
        return null;
    }

    // ───────────────────────────── Helpers ─────────────────────────────

    private IEnumerable<string> CandidatesFor(string? storedPath)
    {
        if (string.IsNullOrWhiteSpace(storedPath)) yield break;

        var raw = storedPath.Trim();
        if (Path.IsPathRooted(raw) && !raw.StartsWith('/') && !raw.StartsWith('\\'))
        {
            // مسیر مطلق (رکوردهای قدیمی): فقط اگر داخل یکی از ریشه‌های مجاز باشد
            var full = Path.GetFullPath(raw);
            if (FileRoots.Any(r => IsUnder(full, r))) yield return full;
            yield break;
        }

        var normalized = Normalize(raw);
        if (normalized == null) yield break;

        // «files/…» پیشوند ثابت است و به ریشه‌ی فایل‌ها نگاشت می‌شود
        var withoutPrefix = normalized.StartsWith(StoredPrefix + "/", StringComparison.OrdinalIgnoreCase)
            ? normalized[(StoredPrefix.Length + 1)..]
            : normalized;

        foreach (var root in FileRoots)
        {
            var full = Path.GetFullPath(Path.Combine(root, withoutPrefix));
            if (IsUnder(full, root)) yield return full;
        }
    }

    /// <summary>مسیر نسبی امن: بدون «..»، بدون درایو و بدون کاراکترهای کنترلی</summary>
    private static string? Normalize(string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return null;
        var p = path.Replace('\\', '/').Trim().TrimStart('/');
        if (p.Length == 0 || p.Contains(':') || p.Any(char.IsControl)) return null;
        var segments = p.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (segments.Any(s => s is "." or "..")) return null;
        return string.Join(Path.DirectorySeparatorChar, segments);
    }

    private static bool IsUnder(string fullPath, string root)
    {
        var rootWithSep = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
                          + Path.DirectorySeparatorChar;
        return fullPath.StartsWith(rootWithSep, OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal);
    }

    private string Resolve(string? configured, string fallback)
    {
        var path = string.IsNullOrWhiteSpace(configured) ? fallback : configured.Trim();
        return Path.GetFullPath(Path.IsPathRooted(path) ? path : Path.Combine(ContentRoot, path));
    }

    private static IReadOnlyList<string> Distinct(params string[] roots)
        => roots.Select(Path.GetFullPath)
            .Distinct(OperatingSystem.IsWindows() ? StringComparer.OrdinalIgnoreCase : StringComparer.Ordinal)
            .ToList();
}
