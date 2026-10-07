using System.ComponentModel.DataAnnotations;

namespace MeetingManagement.Common.Response;

public class Response<T>(ResponseStatus responseStatus, T result = default(T), string message = "")
{
    public ResponseStatus ResponseStatus { get; set; } = responseStatus;
    public string Message { get; set; } = message;
    public T Result { get; set; } = result;
}
public enum ResponseStatus
{
    ///<summary>
    /// 1 - عملیات موفق
    ///</summary>
    [Display(Name = "عملیات موفق")]
    Success = 1,

    /// <summary>
    /// 2 - مورد جدید ساخته شده
    /// </summary>
    [Display(Name = "مورد جدید ساخته شده")]
    Created = 2,

    /// <summary>
    /// 3 - خطای نامعتبر
    /// </summary>
    [Display(Name = "خطای نامعتبر")]
    Invalid = 3,

    /// <summary>
    /// 4 - غیر فعال
    /// </summary>
    [Display(Name = "غیر فعال")]
    Disabled = 4,

    /// <summary>
    /// 5 - مسدود شده
    /// </summary>
    [Display(Name = "مسدود شده")]
    Blocked = 5,

    /// <summary>
    /// 6 - تداخل
    /// </summary>
    [Display(Name = "تداخل")]
    Conflict = 6,

    /// <summary>
    /// 7 - پیدا نشد
    /// </summary>
    [Display(Name = "پیدا نشد")]
    NotFound = 7,

    /// <summary>
    /// 8 - خطای داخلی
    /// </summary>
    [Display(Name = "خطای داخلی")]
    InternalError = 8,

    /// <summary>
    /// خطای دسترسی - 9
    /// </summary>
    [Display(Name = "خطای دسترسی")]
    UnAuthorize = 9,

    ///<summary>
    ///10 - خطای مورد از قبل وجود دارد
    /// </summary>
    [Display(Name = "خطای مورد از قبل وجود دارد")]
    Duplicate = 10,

    ///<summary>
    ///11 - رویداد های اتفاق افتاده
    /// </summary>
    [Display(Name = "رویداد های اتفاق افتاده")]
    Log = 11,
}