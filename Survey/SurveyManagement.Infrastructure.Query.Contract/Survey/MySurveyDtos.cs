using SurveyManagement.Common;

namespace SurveyManagement.Infrastructure.Query.Contract.Survey;

// ===== Request =====

/// <summary>
/// درخواست دریافت نظرسنجی‌های من
/// </summary>
public record GetMySurveysRequest(
    Guid UserGuid,
    MySurveyFilter? Filter = null // فیلتر وضعیت پاسخ
);

/// <summary>
/// فیلتر نظرسنجی‌های من
/// </summary>
public enum MySurveyFilter
{
    /// <summary>همه</summary>
    All = 0,
    /// <summary>شروع نشده</summary>
    NotStarted = 1,
    /// <summary>در حال انجام (Draft)</summary>
    InProgress = 2,
    /// <summary>تکمیل شده</summary>
    Completed = 3,
    /// <summary>منقضی شده (پاسخ نداده)</summary>
    Expired = 4
}

// ===== Response DTOs =====

/// <summary>
/// اطلاعات نظرسنجی برای صفحه "نظرسنجی‌های من"
/// </summary>
public class MySurveyListDto
{
    public Guid Guid { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string StartDate { get; set; } = string.Empty;
    public string EndDate { get; set; } = string.Empty;
    public int TotalQuestions { get; set; }

    // وضعیت نظرسنجی
    public string SurveyStatus { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public bool IsExpired { get; set; }

    // ظاهر
    public string? ThemeColor { get; set; }
    public string? CompletionEffect { get; set; }
    public Guid? LogoGuid { get; set; }

    // تنظیمات
    public bool AllowAnonymous { get; set; }
    public bool AllowSaveDraft { get; set; }
    public int? MaxResponses { get; set; }
    public int TotalResponses { get; set; }
    public bool IsFull { get; set; }

    // ⭐ وضعیت پاسخ کاربر
    public MyResponseStatus ResponseStatus { get; set; }
    public string ResponseStatusText { get; set; } = string.Empty;

    /// <summary>درصد پیشرفت (0-100) — فقط برای Draft</summary>
    public decimal ProgressPercentage { get; set; }

    /// <summary>شناسه Response موجود (اگه Draft داره)</summary>
    public Guid? ExistingResponseGuid { get; set; }

    /// <summary>تاریخ آخرین فعالیت کاربر روی این نظرسنجی</summary>
    public string? LastActivityDate { get; set; }

    // اطلاعات تکمیلی
    public string CreatedBy { get; set; } = string.Empty;
    public int DaysRemaining { get; set; }
}

/// <summary>
/// وضعیت پاسخ کاربر به نظرسنجی
/// </summary>
public enum MyResponseStatus
{
    /// <summary>هنوز شروع نکرده</summary>
    NotStarted = 0,
    /// <summary>در حال انجام (پیش‌نویس)</summary>
    InProgress = 1,
    /// <summary>تکمیل شده</summary>
    Completed = 2,
    /// <summary>منقضی شده بدون پاسخ</summary>
    Expired = 3
}
