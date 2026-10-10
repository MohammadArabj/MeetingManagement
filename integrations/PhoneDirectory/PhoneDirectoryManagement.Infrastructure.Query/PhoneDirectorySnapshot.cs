using System.Text;
using System.Text.RegularExpressions;
using PhoneDirectoryManagement.Infrastructure.Query.Contracts.PhoneDirectory;

namespace PhoneDirectoryManagement.Infrastructure.Query;

/// <summary>
/// نسخه‌ی آماده‌ی کل دفترچه‌ی فعال (همراه نام/سمت/واحد/موبایل متصدیان) در حافظه‌ی سرور.
/// ─────────────────────────────────────────────────────────────────────────
/// علت اصلی کندی: هر جستجو (حتی هر حرف تایپ‌شده در SSO) کل جدول را می‌خواند و برای «همه‌ی» سمت‌ها
/// یک درخواست بزرگ به UserManagement می‌زد؛ تازه بعد از آن فیلتر و صفحه‌بندی در حافظه انجام می‌شد.
/// حالا:
///  • نسخه‌ی آماده ۲ دقیقه تازه است؛ پس از آن فقط «یک» درخواست آن را می‌سازد و بقیه همان نسخه‌ی قبلی را
///    بی‌درنگ می‌گیرند (هیچ‌وقت چند ساخت هم‌زمان).
///  • هر ایجاد/ویرایش/حذف/فعال‌سازی، نسخه را باطل می‌کند تا تغییر فوراً دیده شود.
///  • جستجو روی متن یکسان‌سازی‌شده (ی/ي، ک/ك، ارقام فارسی، نیم‌فاصله) و چندکلمه‌ای است.
/// </summary>
public static class PhoneDirectorySnapshot
{
    private static readonly TimeSpan FreshFor = TimeSpan.FromMinutes(2);
    private static readonly SemaphoreSlim BuildLock = new(1, 1);

    private static volatile Snapshot? _current;
    private static long _version;          // با هر تغییر داده افزایش می‌یابد

    private sealed record Snapshot(IReadOnlyList<Entry> Entries, DateTime BuiltUtc, long Version);

    public sealed record Entry(PhoneDirectoryDialerModel Model, string? Unit, string? HolderName, string PublicText, string FullText);

    /// <summary>پس از هر تغییر داده (ایجاد/ویرایش/حذف/فعال/غیرفعال)</summary>
    public static void Invalidate() => Interlocked.Increment(ref _version);

    public static async Task<IReadOnlyList<Entry>> GetAsync(Func<Task<List<Entry>>> build)
    {
        var snap = _current;
        var version = Interlocked.Read(ref _version);
        if (snap is not null && snap.Version == version && DateTime.UtcNow - snap.BuiltUtc < FreshFor)
            return snap.Entries;

        // کهنه ولی داده تغییر نکرده: یک درخواست می‌سازد، بقیه نسخه‌ی قبلی را بی‌درنگ می‌گیرند
        if (snap is not null && snap.Version == version)
        {
            if (!await BuildLock.WaitAsync(0)) return snap.Entries;
            try { return await RebuildAsync(build, version, snap); }
            finally { BuildLock.Release(); }
        }

        // اولین بار یا داده تغییر کرده: باید منتظر نسخه‌ی تازه ماند (فقط یک ساخت)
        await BuildLock.WaitAsync();
        try
        {
            var latest = _current;
            if (latest is not null && latest.Version == Interlocked.Read(ref _version)
                && DateTime.UtcNow - latest.BuiltUtc < FreshFor)
                return latest.Entries;
            return await RebuildAsync(build, Interlocked.Read(ref _version), latest);
        }
        finally { BuildLock.Release(); }
    }

    private static async Task<IReadOnlyList<Entry>> RebuildAsync(Func<Task<List<Entry>>> build, long version, Snapshot? fallback)
    {
        try
        {
            var entries = await build();
            _current = new Snapshot(entries, DateTime.UtcNow, version);
            return entries;
        }
        catch when (fallback is not null)
        {
            // UserManagement یا پایگاه داده موقتاً در دسترس نیست: نسخه‌ی قبلی بهتر از خطاست
            return fallback.Entries;
        }
    }

    public static IEnumerable<Entry> Filter(IEnumerable<Entry> entries, string? search, int? type, bool full)
    {
        if (type.HasValue) entries = entries.Where(e => e.Model.Type == type.Value);
        var terms = Normalize(search).Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (terms.Length == 0) return entries;
        return entries.Where(e =>
        {
            var text = full ? e.FullText : e.PublicText;
            return terms.All(t => text.Contains(t, StringComparison.Ordinal));
        });
    }

    public static string Normalize(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        var sb = new StringBuilder(text.Length);
        foreach (var ch in text)
        {
            var c = ch switch
            {
                'ي' or 'ى' => 'ی',
                'ك' => 'ک',
                'ة' => 'ه',
                'أ' or 'إ' or 'آ' or 'ٱ' => 'ا',
                'ؤ' => 'و',
                '‌' or '‏' or '‎' or '-' or '_' or '/' => ' ',
                >= '۰' and <= '۹' => (char)('0' + (ch - '۰')),
                >= '٠' and <= '٩' => (char)('0' + (ch - '٠')),
                _ => char.ToLowerInvariant(ch)
            };
            if (c is >= 'ً' and <= 'ٟ') continue;
            sb.Append(c);
        }
        return Regex.Replace(sb.ToString(), @"\s+", " ").Trim();
    }

    /// <summary>ارقام شماره بدون خط تیره/فاصله (۰۲۱۱۲۳۴ ↔ ۰۲۱-۱۲۳۴)</summary>
    public static string Digits(string? text) => new(Normalize(text).Where(char.IsAsciiDigit).ToArray());
}
