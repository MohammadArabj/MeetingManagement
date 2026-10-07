using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Reflection;

namespace SurveyManagement.Common;

/// <summary>
/// انواع سوالات نظرسنجی
/// </summary>
public enum QuestionType
{
    /// <summary>
    /// تک گزینه‌ای (رادیو باتن)
    /// </summary>
    /// 
    [Description("تک گزینه‌ای (رادیو باتن)")]
    SingleChoice = 1,

    /// <summary>
    /// چند گزینه‌ای (چک باکس)
    /// </summary>
    /// 
    [Description("چند گزینه‌ای (چک باکس)")]
    MultipleChoice = 2,
    
    /// <summary>
    /// متن کوتاه
    /// </summary>
    [Description("متن کوتاه")]
    ShortText = 3,

    /// <summary>
    /// متن بلند (توضیحات)
    /// </summary>
    [Description("متن بلند (توضیحات)")]
    LongText = 4,

    /// <summary>
    /// امتیازدهی (Rating)
    /// </summary>
    [Description("امتیازدهی (Rating)")]
    Rating = 5,

    /// <summary>
    /// مقیاس خطی (Linear Scale)
    /// </summary>
    [Description("مقیاس خطی (Linear Scale)")]
    LinearScale = 6,

    /// <summary>
    /// تاریخ
    /// </summary>
    [Description("تاریخ")]
    Date = 7,

    /// <summary>
    /// زمان
    /// </summary>
    [Description("زمان")]
    Time = 8,

    /// <summary>
    /// آپلود فایل
    /// </summary>
    [Description("آپلود فایل")]
    FileUpload = 9,

    /// <summary>
    /// دراپ داون (لیست کشویی)
    /// </summary>
    [Description("دراپ داون (لیست کشویی)")]
    Dropdown = 10,

    /// <summary>
    /// ماتریسی - تک انتخابی
    /// </summary>
    [Description("ماتریسی - تک انتخابی")]
    MatrixSingle = 11,

    /// <summary>
    /// ماتریسی - چند انتخابی
    /// </summary>
    [Description("ماتریسی - چند انتخابی")]
    MatrixMultiple = 12,

    /// <summary>
    /// رتبه‌بندی
    /// </summary>
    [Description("رتبه‌بندی")]
    Ranking = 13,

    /// <summary>
    /// عدد
    /// </summary>
    [Description("عدد")]
    Number = 14,

    /// <summary>
    /// ایمیل
    /// </summary>
    [Description("ایمیل")]
    Email = 15,

    /// <summary>
    /// شماره تلفن
    /// </summary>
    [Description("شماره تلفن")]
    Phone = 16,

    /// <summary>
    /// آدرس
    /// </summary>
    [Description("آدرس")]
    Address = 17,

    /// <summary>
    /// بله/خیر
    /// </summary>
    [Description("بله/خیر")]
    YesNo = 18,

    /// <summary>
    /// NPS (Net Promoter Score)
    /// </summary>
    [Description("NPS (Net Promoter Score)")]
    NPS = 19
}

/// <summary>
/// وضعیت نظرسنجی
/// </summary>
public enum SurveyStatus
{
    /// <summary>
    /// پیش‌نویس
    /// </summary>
    /// 
    [Description("پیش نویس")]
    Draft = 1,
    
    /// <summary>
    /// منتشر شده
    /// </summary>
    [Description("منتشر شده")]
    Published = 2,

    /// <summary>
    /// در حال اجرا
    /// </summary>
    [Description("در حال اجرا")]
    Active = 3,

    /// <summary>
    /// بسته شده
    /// </summary>
    [Description("بسته شده")]
    Closed = 4,

    /// <summary>
    /// آرشیو شده
    /// </summary>
    [Description("آرشیو شده")]
    Archived = 5,

    /// <summary>
    /// متوقف شده
    /// </summary>
    [Description("متوقف شده")]
    Paused = 6
}

/// <summary>
/// نوع دسترسی نظرسنجی
/// </summary>
public enum AccessType
{
    /// <summary>
    /// عمومی - همه سازمان
    /// </summary>
    /// 
    [Description("عمومی")]
    Public = 1,
    
    /// <summary>
    /// خصوصی - افراد خاص
    /// </summary>
    [Description("خصوصی")]
    Private = 2,

    /// <summary>
    /// بر اساس واحد سازمانی
    /// </summary>
    [Description("بر اساس واحد سازمانی")]
    ByUnit = 3,

    /// <summary>
    /// بر اساس سمت
    /// </summary>
    [Description("بر اساس سمت")]
    ByPosition = 4,

    /// <summary>
    /// ترکیبی
    /// </summary>
    [Description("ترکیبی")]
    Mixed = 5
}


public enum ShowType
{
    Slide= 1,
    OnePage=2
}

/// <summary>
/// نوع هدف دسترسی
/// </summary>
public enum TargetType
{
    /// <summary>
    /// کاربر مشخص
    /// </summary>
    User = 1,
    
    /// <summary>
    /// واحد سازمانی
    /// </summary>
    Unit = 2,
    
    /// <summary>
    /// سمت
    /// </summary>
    Position = 3,
    
    /// <summary>
    /// نقش
    /// </summary>
    Role = 4
}

/// <summary>
/// وضعیت پاسخ
/// </summary>
public enum ResponseStatus
{
    /// <summary>
    /// شروع نشده
    /// </summary>
    /// 
    [Description("شروع نشده")]
    NotStarted = 1,
    
    /// <summary>
    /// در حال پاسخ‌دهی (پیش‌نویس)
    /// </summary>
    [Description("در حال پاسخ‌دهی (پیش‌نویس)")]
    InProgress = 2,

    /// <summary>
    /// تکمیل شده
    /// </summary>
    /// 
    [Description("تکمیل شده")]
    Completed = 3,
    
    /// <summary>
    /// منقضی شده (تاریخ گذشته)
    /// </summary>
    [Description("منقضی شده (تاریخ گذشته)")]
    Expired = 4
}

/// <summary>
/// نوع منطق شرطی
/// </summary>
public enum LogicType
{
    /// <summary>
    /// نمایش سوال
    /// </summary>
    ShowQuestion = 1,
    
    /// <summary>
    /// مخفی کردن سوال
    /// </summary>
    HideQuestion = 2,
    
    /// <summary>
    /// پرش به سوال
    /// </summary>
    SkipToQuestion = 3,
    
    /// <summary>
    /// پایان نظرسنجی
    /// </summary>
    EndSurvey = 4
}

/// <summary>
/// عملگر شرطی
/// </summary>
public enum ConditionOperator
{
    /// <summary>
    /// برابر است با
    /// </summary>
    Equals = 1,
    
    /// <summary>
    /// برابر نیست با
    /// </summary>
    NotEquals = 2,
    
    /// <summary>
    /// شامل می‌شود
    /// </summary>
    Contains = 3,
    
    /// <summary>
    /// شامل نمی‌شود
    /// </summary>
    NotContains = 4,
    
    /// <summary>
    /// بزرگتر از
    /// </summary>
    GreaterThan = 5,
    
    /// <summary>
    /// کوچکتر از
    /// </summary>
    LessThan = 6,
    
    /// <summary>
    /// پاسخ داده شده
    /// </summary>
    IsAnswered = 7,
    
    /// <summary>
    /// پاسخ داده نشده
    /// </summary>
    IsNotAnswered = 8
}

/// <summary>
/// نوع اعتبارسنجی
/// </summary>
public enum ValidationType:byte
{
    /// <summary>
    /// بدون اعتبارسنجی
    /// </summary>
    None = 0,
    
    /// <summary>
    /// ایمیل
    /// </summary>
    Email = 1,
    
    /// <summary>
    /// شماره تلفن
    /// </summary>
    Phone = 2,
    
    /// <summary>
    /// کد ملی
    /// </summary>
    NationalCode = 3,
    
    /// <summary>
    /// عدد
    /// </summary>
    Number = 4,
    
    /// <summary>
    /// محدوده عددی
    /// </summary>
    NumberRange = 5,
    
    /// <summary>
    /// طول متن
    /// </summary>
    TextLength = 6,
    
    /// <summary>
    /// Regex سفارشی
    /// </summary>
    CustomRegex = 7,
    
    /// <summary>
    /// URL
    /// </summary>
    Url = 8
}

/// <summary>
/// نوع تغییرات لاگ
/// </summary>
public enum ChangeType
{
    /// <summary>
    /// ایجاد
    /// </summary>
    Created = 1,
    
    /// <summary>
    /// ویرایش
    /// </summary>
    Updated = 2,
    
    /// <summary>
    /// حذف
    /// </summary>
    Deleted = 3,
    
    /// <summary>
    /// انتشار
    /// </summary>
    Published = 4,
    
    /// <summary>
    /// بستن
    /// </summary>
    Closed = 5,
    
    /// <summary>
    /// متوقف کردن
    /// </summary>
    Paused = 6,
    
    /// <summary>
    /// از سرگیری
    /// </summary>
    Resumed = 7
}

/// <summary>
/// نقش در نظرسنجی
/// </summary>
public enum SurveyRole
{
    /// <summary>
    /// مدیر کل سیستم
    /// </summary>
    SystemAdmin = 1,
    
    /// <summary>
    /// سازنده نظرسنجی
    /// </summary>
    Creator = 2,
    
    /// <summary>
    /// ناظر
    /// </summary>
    Viewer = 3,
    
    /// <summary>
    /// پاسخ‌دهنده
    /// </summary>
    Respondent = 4
}
