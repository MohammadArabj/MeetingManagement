using System.Collections.Concurrent;
using Microsoft.Extensions.Caching.Memory;

namespace EPC.SSO.Infrastructure;

/// <summary>
/// کش یکپارچه‌ی SSO.
///
/// مشکلاتی که این کلاس حل می‌کند:
///  ۰) Stale-while-revalidate: پس از تازگی، داده‌ی قبلی فوراً برگردانده و در پس‌زمینه تازه می‌شود؛
///     کاربر هرگز منتظر API کند نمی‌ماند مگر بار اولی که داده‌ای وجود ندارد.
///  ۱) Cache Stampede: وقتی کش منقضی می‌شد، صدها درخواست هم‌زمان همگی به API پشتی
///     حمله می‌کردند. اینجا برای هر کلید فقط «یک» درخواست به منبع می‌رود و بقیه منتظر
///     همان نتیجه می‌مانند.
///  ۲) کش‌کردن خطا به‌عنوان «لیست خالی» برای ۵ دقیقه: قبلاً اگر API یک‌بار جواب نمی‌داد،
///     لیست خالی ۵ دقیقه کش می‌شد. اینجا factory با برگرداندن null خطا را اعلام می‌کند و:
///       - اگر نسخه‌ی قدیمی (Stale) موجود باشد همان برگردانده می‌شود (کاربر چیزی نمی‌فهمد)
///       - اگر نباشد، فقط ۱۵ ثانیه Negative-Cache می‌شود تا API از کارافتاده زیر بار نرود.
///  ۳) همه‌ی entryها Size=1 دارند و SizeLimit در Startup متناسب با تعداد کاربر تنظیم شده؛
///     قبلاً SizeLimit=1024 بود که با چند صد کاربر پر می‌شد و از آن به بعد کش عملاً کار نمی‌کرد.
/// </summary>
public interface IAppCache
{
    /// <param name="factory">null یعنی «خطا/نامعتبر» — کش نمی‌شود.</param>
    /// <param name="freshFor">مدت تازه بودن داده.</param>
    /// <param name="staleFor">بعد از تازگی، تا این مدت به‌عنوان پشتیبان در صورت خطا نگه داشته می‌شود.</param>
    Task<T?> GetOrCreateAsync<T>(
        string key,
        Func<CancellationToken, Task<T?>> factory,
        TimeSpan freshFor,
        TimeSpan? staleFor = null,
        CancellationToken cancellationToken = default) where T : class;

    bool TryGet<T>(string key, out T? value) where T : class;

    void Set<T>(string key, T value, TimeSpan freshFor, TimeSpan? staleFor = null) where T : class;

    void Remove(string key);
}

public sealed class AppCache(IMemoryCache memoryCache, ILogger<AppCache> logger) : IAppCache
{
    private static readonly TimeSpan NegativeCacheDuration = TimeSpan.FromSeconds(15);

    /// <summary>حداکثر زمان یک بارگذاری از منبع؛ مستقل از لغو درخواست کاربری که آن را شروع کرده</summary>
    private static readonly TimeSpan LoadTimeout = TimeSpan.FromSeconds(20);

    /// <summary>
    /// بارگذاری‌های در حال اجرا (single-flight): برای هر کلید حداکثر یک درخواست به منبع.
    /// پس از پایان حذف می‌شود؛ برخلاف قفل‌های striped قبلی، کلیدهای نامرتبط هرگز منتظر هم نمی‌مانند
    /// و قفلی در طول فراخوانی شبکه نگه داشته نمی‌شود.
    /// </summary>
    private readonly ConcurrentDictionary<string, Lazy<Task<object?>>> _inflight = new();

    private sealed record Entry<T>(T Value, DateTime FreshUntilUtc);
    private sealed record NegativeEntry;

    public async Task<T?> GetOrCreateAsync<T>(
        string key,
        Func<CancellationToken, Task<T?>> factory,
        TimeSpan freshFor,
        TimeSpan? staleFor = null,
        CancellationToken cancellationToken = default) where T : class
    {
        if (memoryCache.TryGetValue(key, out Entry<T>? entry) && entry is not null)
        {
            if (entry.FreshUntilUtc > DateTime.UtcNow)
                return entry.Value;

            // Stale-while-revalidate: داده‌ی قبلی بی‌درنگ برگردانده می‌شود و به‌روزرسانی در پس‌زمینه انجام می‌شود.
            // (قبلاً هر ۲ تا ۳ دقیقه یک کاربر باید منتظر کندترین API می‌ماند.)
            _ = LoadAsync(key, factory, freshFor, staleFor);
            return entry.Value;
        }

        if (memoryCache.TryGetValue(NegativeKey(key), out NegativeEntry? _))
            return null;

        // داده‌ای نیست: منتظر بارگذاری (مشترک با درخواست‌های همزمان دیگر) می‌مانیم
        return await LoadAsync(key, factory, freshFor, staleFor).WaitAsync(cancellationToken);
    }

    private async Task<T?> LoadAsync<T>(string key, Func<CancellationToken, Task<T?>> factory, TimeSpan freshFor, TimeSpan? staleFor)
        where T : class
    {
        var job = _inflight.GetOrAdd(key, k => new Lazy<Task<object?>>(() => RunFactoryAsync(k, factory, freshFor, staleFor)));
        return (T?)await job.Value;
    }

    private async Task<object?> RunFactoryAsync<T>(string key, Func<CancellationToken, Task<T?>> factory, TimeSpan freshFor, TimeSpan? staleFor)
        where T : class
    {
        try
        {
            using var timeout = new CancellationTokenSource(LoadTimeout);
            T? value = null;
            try
            {
                value = await factory(timeout.Token);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "[AppCache] بارگذاری کلید {Key} خطا داد", key);
            }

            if (value is not null)
            {
                Set(key, value, freshFor, staleFor);
                return value;
            }

            // منبع در دسترس نیست: نسخه‌ی قدیمی (اگر هست) دست‌نخورده می‌ماند؛ وگرنه کوتاه Negative-Cache
            if (memoryCache.TryGetValue(key, out Entry<T>? stale) && stale is not null)
            {
                logger.LogInformation("[AppCache] منبع در دسترس نیست؛ نسخه‌ی قدیمی {Key} حفظ شد", key);
                return stale.Value;
            }

            memoryCache.Set(NegativeKey(key), new NegativeEntry(), new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = NegativeCacheDuration,
                Size = 1
            });
            return null;
        }
        finally
        {
            _inflight.TryRemove(key, out _);
        }
    }

    public bool TryGet<T>(string key, out T? value) where T : class
    {
        if (memoryCache.TryGetValue(key, out Entry<T>? entry) && entry is not null)
        {
            value = entry.Value;
            return true;
        }

        value = null;
        return false;
    }

    public void Set<T>(string key, T value, TimeSpan freshFor, TimeSpan? staleFor = null) where T : class
    {
        var stale = staleFor ?? TimeSpan.Zero;
        memoryCache.Set(key, new Entry<T>(value, DateTime.UtcNow.Add(freshFor)), new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = freshFor + stale,
            Size = 1
        });
        memoryCache.Remove(NegativeKey(key));
    }

    public void Remove(string key)
    {
        memoryCache.Remove(key);
        memoryCache.Remove(NegativeKey(key));
    }

    private static string NegativeKey(string key) => "neg:" + key;
}
