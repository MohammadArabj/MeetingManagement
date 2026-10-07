using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using FileManagement.Common;
using SkiaSharp;

namespace FileManagement.Presentation.Api.Media;

/// <summary>نتیجه‌ی آماده برای ارسال: فایل کش‌شده روی دیسک</summary>
public sealed record ImageRendition(string PhysicalPath, string ContentType, string ETag, DateTimeOffset LastModified);

/// <summary>
/// ساخت و کش بندانگشتی تصاویر (عکس پرسنلی، امضا، پیوست‌های تصویری).
/// ─────────────────────────────────────────────────────────────────────────
///  • هر اندازه فقط یک بار ساخته و روی دیسک (FileSettings:CachePath) نگه داشته می‌شود؛ درخواست‌های بعدی
///    مستقیم از فایل کش (با ETag و 304) پاسخ می‌گیرند.
///  • خروجی WebP برای مرورگرهای پشتیبان (حدود ۳۰٪ کوچک‌تر از JPEG) و JPEG برای بقیه.
///  • JPEGهای بزرگ با کاهش مقیاس در زمان Decode (۱/۲، ۱/۴، ۱/۸) خوانده می‌شوند: سریع و کم‌حافظه.
///  • جهت عکس طبق EXIF اصلاح می‌شود (عکس‌های موبایل کج نمایش داده نمی‌شوند).
///  • برای یک کلید همزمان فقط یک بار پردازش انجام می‌شود (single-flight) و تعداد پردازش موازی محدود است.
///  • تصاویر بسیار بزرگ (بمب فشرده‌سازی) پردازش نمی‌شوند.
/// </summary>
public sealed class ImageThumbnailService(FileStorageLocations locations, ILogger<ImageThumbnailService> logger)
{
    private static readonly int[] Widths = [32, 48, 64, 96, 128, 160, 256, 320, 480, 640, 960, 1280, 1920];
    private static readonly HashSet<string> Resizable = new(StringComparer.OrdinalIgnoreCase)
        { ".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp" };

    private const long MaxSourceBytes = 150L * 1024 * 1024;
    private const long MaxSourcePixels = 120_000_000;

    private static readonly SemaphoreSlim Gate = new(Math.Max(2, Environment.ProcessorCount));
    private readonly ConcurrentDictionary<string, Lazy<Task<bool>>> _inflight = new();

    public static bool IsResizable(string? fileNameOrExt)
        => !string.IsNullOrEmpty(fileNameOrExt) && Resizable.Contains(Path.GetExtension(fileNameOrExt) is { Length: > 0 } e ? e : fileNameOrExt);

    /// <summary>نزدیک‌ترین عرض مجاز (بزرگ‌تر یا مساوی)؛ تعداد اندازه‌های قابل ساخت محدود می‌ماند</summary>
    public static int SnapWidth(int requested)
    {
        foreach (var w in Widths)
            if (w >= requested) return w;
        return Widths[^1];
    }

    public static bool AcceptsWebp(HttpRequest request)
        => request.Headers.Accept.ToString().Contains("image/webp", StringComparison.OrdinalIgnoreCase);

    public async Task<ImageRendition?> GetAsync(string sourcePath, int width, int quality, bool webp, CancellationToken ct)
    {
        var source = new FileInfo(sourcePath);
        if (!source.Exists || source.Length > MaxSourceBytes) return null;

        width = SnapWidth(width);
        quality = Math.Clamp(quality, 40, 95);
        var format = webp ? "webp" : "jpg";

        var key = Hash($"{source.FullName}|{source.LastWriteTimeUtc.Ticks}|{source.Length}|{width}|{quality}|{format}");
        var cachePath = Path.Combine(locations.CacheRoot, "img", key[..2], $"{key}.{format}");
        var contentType = webp ? "image/webp" : "image/jpeg";

        if (!File.Exists(cachePath))
        {
            var job = _inflight.GetOrAdd(cachePath, p => new Lazy<Task<bool>>(() => RenderAsync(source.FullName, p, width, quality, webp)));
            bool ok;
            try { ok = await job.Value.WaitAsync(ct); }
            finally { _inflight.TryRemove(new KeyValuePair<string, Lazy<Task<bool>>>(cachePath, job)); }
            if (!ok) return null;
        }
        else
        {
            Touch(cachePath);
        }

        return new ImageRendition(cachePath, contentType, $"\"{key[..20]}\"", new DateTimeOffset(source.LastWriteTimeUtc));
    }

    private async Task<bool> RenderAsync(string sourcePath, string cachePath, int width, int quality, bool webp)
    {
        await Gate.WaitAsync();
        try
        {
            return await Task.Run(() => Render(sourcePath, cachePath, width, quality, webp));
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Thumbnail generation failed for {File}", Path.GetFileName(sourcePath));
            return false;
        }
        finally
        {
            Gate.Release();
        }
    }

    private static bool Render(string sourcePath, string cachePath, int width, int quality, bool webp)
    {
        using var stream = File.OpenRead(sourcePath);
        using var codec = SKCodec.Create(stream);
        if (codec == null) return false;

        var info = codec.Info;
        if (info.Width <= 0 || info.Height <= 0 || (long)info.Width * info.Height > MaxSourcePixels) return false;

        var origin = codec.EncodedOrigin;
        var swap = origin is SKEncodedOrigin.LeftTop or SKEncodedOrigin.RightTop or SKEncodedOrigin.RightBottom or SKEncodedOrigin.LeftBottom;
        var displayWidth = swap ? info.Height : info.Width;
        var displayHeight = swap ? info.Width : info.Height;

        var targetWidth = Math.Min(width, displayWidth);
        var targetHeight = Math.Max(1, (int)Math.Round((double)displayHeight * targetWidth / displayWidth));

        // Decode با کاهش مقیاس (برای JPEG بسیار سریع‌تر از Decode کامل + Resize)
        var desiredScale = (float)targetWidth / displayWidth;
        var scaled = codec.GetScaledDimensions(Math.Max(desiredScale, 1f / 8));
        if (scaled.Width < (swap ? targetHeight : targetWidth)) scaled = info.Size;

        var decodeInfo = new SKImageInfo(scaled.Width, scaled.Height, SKColorType.Rgba8888, SKAlphaType.Premul);
        using var decoded = new SKBitmap(decodeInfo);
        var result = codec.GetPixels(decodeInfo, decoded.GetPixels());
        if (result is not (SKCodecResult.Success or SKCodecResult.IncompleteInput)) return false;

        using var surface = SKSurface.Create(new SKImageInfo(targetWidth, targetHeight, SKColorType.Rgba8888, SKAlphaType.Premul));
        var canvas = surface.Canvas;
        if (!webp) canvas.Clear(SKColors.White); // JPEG شفافیت ندارد
        else canvas.Clear(SKColors.Transparent);

        ApplyOrientation(canvas, origin, targetWidth, targetHeight);
        var drawWidth = swap ? targetHeight : targetWidth;
        var drawHeight = swap ? targetWidth : targetHeight;

        using var image = SKImage.FromBitmap(decoded);
        canvas.DrawImage(image, new SKRect(0, 0, drawWidth, drawHeight), new SKSamplingOptions(SKCubicResampler.Mitchell));
        canvas.Flush();

        using var snapshot = surface.Snapshot();
        using var data = snapshot.Encode(webp ? SKEncodedImageFormat.Webp : SKEncodedImageFormat.Jpeg, quality);
        if (data == null) return false;

        Directory.CreateDirectory(Path.GetDirectoryName(cachePath)!);
        var temp = cachePath + "." + Guid.NewGuid().ToString("N")[..8] + ".tmp";
        using (var output = File.Create(temp))
            data.SaveTo(output);
        File.Move(temp, cachePath, overwrite: true);
        return true;
    }

    /// <summary>
    /// نگاشت مختصات تصویر خام به جهت نمایشی EXIF (w و h ابعاد خروجی نمایشی هستند).
    /// عملیات Canvas به ترتیب معکوس روی نقاط اعمال می‌شوند.
    /// </summary>
    private static void ApplyOrientation(SKCanvas canvas, SKEncodedOrigin origin, int w, int h)
    {
        switch (origin)
        {
            case SKEncodedOrigin.TopRight:    canvas.Translate(w, 0); canvas.Scale(-1, 1); break;            // (w-x, y)
            case SKEncodedOrigin.BottomRight: canvas.Translate(w, h); canvas.RotateDegrees(180); break;      // (w-x, h-y)
            case SKEncodedOrigin.BottomLeft:  canvas.Translate(0, h); canvas.Scale(1, -1); break;            // (x, h-y)
            case SKEncodedOrigin.LeftTop:     canvas.RotateDegrees(90); canvas.Scale(1, -1); break;          // (y, x)
            case SKEncodedOrigin.RightTop:    canvas.Translate(w, 0); canvas.RotateDegrees(90); break;       // (w-y, x)
            case SKEncodedOrigin.RightBottom: canvas.Translate(w, h); canvas.RotateDegrees(270); canvas.Scale(1, -1); break; // (w-y, h-x)
            case SKEncodedOrigin.LeftBottom:  canvas.Translate(0, h); canvas.RotateDegrees(270); break;      // (y, h-x)
        }
    }

    /// <summary>برای پاک‌سازی LRU؛ حداکثر روزی یک بار زمان فایل به‌روز می‌شود</summary>
    private static void Touch(string path)
    {
        try
        {
            var info = new FileInfo(path);
            if (info.LastWriteTimeUtc < DateTime.UtcNow.AddDays(-1)) info.LastWriteTimeUtc = DateTime.UtcNow;
        }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }

    private static string Hash(string value)
        => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
}
