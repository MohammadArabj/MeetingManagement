using System.ComponentModel;
using System.Globalization;
using System.Linq.Expressions;
using System.Reflection;

namespace SurveyManagement.Common.Extensions;

/// <summary>
/// Extension methods برای DateTime
/// </summary>
public static class DateTimeExtensions
{
    /// <summary>
    /// تبدیل string به DateTime
    /// </summary>
    //public static DateTime ToDateTime(this string dateString)
    //{
    //    if (string.IsNullOrEmpty(dateString))
    //        return DateTime.MinValue;

    //    // تلاش برای Parse استاندارد
    //    if (DateTime.TryParse(dateString, out var result))
    //        return result;

    //    // تلاش برای فرمت‌های مختلف
    //    string[] formats = {
    //        "yyyy/MM/dd",
    //        "yyyy-MM-dd",
    //        "yyyy/MM/dd HH:mm:ss",
    //        "yyyy-MM-dd HH:mm:ss",
    //        "dd/MM/yyyy",
    //        "dd-MM-yyyy"
    //    };

    //    if (DateTime.TryParseExact(dateString, formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out result))
    //        return result;

    //    return DateTime.MinValue;
    //}

    ///// <summary>
    ///// تبدیل string به DateTime? (Nullable)
    ///// </summary>
    //public static DateTime? ToDateTimeNull(this string? dateString)
    //{
    //    if (string.IsNullOrEmpty(dateString))
    //        return null;

    //    // تلاش برای Parse استاندارد
    //    if (DateTime.TryParse(dateString, out var result))
    //        return result;

    //    // تلاش برای فرمت‌های مختلف
    //    string[] formats = {
    //        "yyyy/MM/dd",
    //        "yyyy-MM-dd",
    //        "yyyy/MM/dd HH:mm:ss",
    //        "yyyy-MM-dd HH:mm:ss",
    //        "dd/MM/yyyy",
    //        "dd-MM-yyyy"
    //    };

    //    if (DateTime.TryParseExact(dateString, formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out result))
    //        return result;

    //    return null;
    //}

    /// <summary>
    /// تبدیل DateTime به string با فرمت فارسی
    /// </summary>
    public static string ToPersianDate(this DateTime dateTime)
    {
        // TODO: پیاده‌سازی تبدیل به تاریخ شمسی در صورت نیاز
        return dateTime.ToString("yyyy/MM/dd");
    }

    /// <summary>
    /// تبدیل DateTime? به string با فرمت فارسی
    /// </summary>
    public static string? ToPersianDate(this DateTime? dateTime)
    {
        return dateTime?.ToString("yyyy/MM/dd");
    }
}

/// <summary>
/// Extension methods برای IQueryable
/// </summary>
public static class QueryableExtensions
{
    /// <summary>
    /// اعمال شرط به Query در صورتی که condition برقرار باشد
    /// </summary>
    public static IQueryable<T> WhereIf<T>(
        this IQueryable<T> query,
        bool condition,
        Expression<Func<T, bool>> predicate)
    {
        return condition ? query.Where(predicate) : query;
    }

    /// <summary>
    /// صفحه‌بندی
    /// </summary>
    public static IQueryable<T> Paginate<T>(
        this IQueryable<T> query,
        int pageNumber,
        int pageSize)
    {
        return query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize);
    }
}

/// <summary>
/// Extension methods برای Enum
/// </summary>
public static class EnumExtensions
{
    /// <summary>
    /// دریافت DisplayName از Description attribute
    /// </summary>
    public static string GetDisplayName(this Enum value)
    {
        var field = value.GetType().GetField(value.ToString());
        if (field == null)
            return value.ToString();

        var attribute = field.GetCustomAttribute<DescriptionAttribute>();
        return attribute?.Description ?? value.ToString();
    }

    /// <summary>
    /// دریافت لیست تمام مقادیر یک Enum
    /// </summary>
    public static List<T> GetAllValues<T>() where T : Enum
    {
        return Enum.GetValues(typeof(T)).Cast<T>().ToList();
    }

    /// <summary>
    /// دریافت Dictionary از Enum (Value, DisplayName)
    /// </summary>
    public static Dictionary<int, string> GetEnumDictionary<T>() where T : Enum
    {
        return Enum.GetValues(typeof(T))
            .Cast<T>()
            .ToDictionary(
                e => Convert.ToInt32(e),
                e => e.GetDisplayName()
            );
    }
}

/// <summary>
/// Extension methods برای String
/// </summary>
public static class StringExtensions
{
    /// <summary>
    /// بررسی خالی نبودن string
    /// </summary>
    public static bool HasValue(this string? value)
    {
        return !string.IsNullOrWhiteSpace(value);
    }

    /// <summary>
    /// برش string با حفظ کلمات
    /// </summary>
    public static string Truncate(this string value, int maxLength, string suffix = "...")
    {
        if (string.IsNullOrEmpty(value) || value.Length <= maxLength)
            return value;

        var truncated = value.Substring(0, maxLength);
        var lastSpace = truncated.LastIndexOf(' ');

        if (lastSpace > 0)
            truncated = truncated.Substring(0, lastSpace);

        return truncated + suffix;
    }

    /// <summary>
    /// تبدیل به Guid
    /// </summary>
    public static Guid? ToGuid(this string? value)
    {
        if (string.IsNullOrEmpty(value))
            return null;

        if (Guid.TryParse(value, out var guid))
            return guid;

        return null;
    }
}

/// <summary>
/// Extension methods برای Collection
/// </summary>
public static class CollectionExtensions
{
    /// <summary>
    /// بررسی خالی نبودن Collection
    /// </summary>
    public static bool HasItems<T>(this IEnumerable<T>? collection)
    {
        return collection?.Any() == true;
    }

    /// <summary>
    /// Safe foreach - اگر null بود خطا نمی‌دهد
    /// </summary>
    public static void ForEachSafe<T>(this IEnumerable<T>? collection, Action<T> action)
    {
        if (collection == null)
            return;

        foreach (var item in collection)
        {
            action(item);
        }
    }

    /// <summary>
    /// تبدیل به Dictionary با چک null
    /// </summary>
    public static Dictionary<TKey, TValue> SafeToDictionary<TSource, TKey, TValue>(
        this IEnumerable<TSource>? source,
        Func<TSource, TKey> keySelector,
        Func<TSource, TValue> valueSelector)
        where TKey : notnull
    {
        if (source == null)
            return new Dictionary<TKey, TValue>();

        return source.ToDictionary(keySelector, valueSelector);
    }
}

/// <summary>
/// Extension methods برای Guid
/// </summary>
public static class GuidExtensions
{
    /// <summary>
    /// بررسی خالی نبودن Guid
    /// </summary>
    public static bool HasValue(this Guid guid)
    {
        return guid != Guid.Empty;
    }

    /// <summary>
    /// بررسی خالی نبودن Guid?
    /// </summary>
    public static bool HasValue(this Guid? guid)
    {
        return guid.HasValue && guid.Value != Guid.Empty;
    }
}
