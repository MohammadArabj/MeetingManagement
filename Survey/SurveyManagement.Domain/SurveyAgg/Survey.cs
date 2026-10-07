using Epc.Domain;
using SurveyManagement.Common;
using SurveyManagement.Domain.QuestionAgg;
using SurveyManagement.Domain.ResponseAgg;
using SurveyManagement.Domain.SurveyCriterionAgg;

namespace SurveyManagement.Domain.SurveyAgg;

/// <summary>
/// نظرسنجی - Aggregate Root
/// </summary>
public class Survey : AuditableAggregateRootBase<long>
{
    public Survey() { } // برای EF Core

    public Survey(
        Guid creator,
        string title,
        string description,
        DateTime startDate,
        DateTime endDate,
        AccessType accessType,
        ShowType showType,
        bool allowAnonymous,
        bool allowSaveDraft,
        bool showProgressBar,
        bool randomizeQuestions,
        bool allowMultipleResponses,
        string? welcomeMessage,
        string? thankYouMessage,
        int? maxResponses,
        bool requireLogin)
        : base(creator)
    {
        Title = title;
        Description = description;
        StartDate = startDate;
        EndDate = endDate;
        AccessType = accessType;
        ShowType = showType;
        AllowAnonymous = allowAnonymous;
        AllowSaveDraft = allowSaveDraft;
        ShowProgressBar = showProgressBar;
        RandomizeQuestions = randomizeQuestions;
        AllowMultipleResponses = allowMultipleResponses;
        WelcomeMessage = welcomeMessage;
        ThankYouMessage = thankYouMessage;
        MaxResponses = maxResponses;
        RequireLogin = requireLogin;
        Status = SurveyStatus.Draft;
        TotalResponses = 0;
        Version = 1;
    }

    
    /// <summary>
    /// عنوان نظرسنجی
    /// </summary>
    public string Title { get; private set; }
    
    /// <summary>
    /// توضیحات نظرسنجی
    /// </summary>
    public string Description { get; private set; }
    
    /// <summary>
    /// تاریخ شروع
    /// </summary>
    public DateTime StartDate { get; private set; }
    
    /// <summary>
    /// تاریخ پایان
    /// </summary>
    public DateTime EndDate { get; private set; }
    
    /// <summary>
    /// وضعیت نظرسنجی
    /// </summary>
    public SurveyStatus Status { get; private set; }
    
    /// <summary>
    /// نوع دسترسی
    /// </summary>
    public AccessType AccessType { get; private set; }


    public ShowType ShowType { get; private set; }
    /// <summary>
    /// آیا پاسخ ناشناس مجاز است؟
    /// </summary>
    public bool AllowAnonymous { get; private set; }
    
    /// <summary>
    /// آیا ذخیره پیش‌نویس مجاز است؟
    /// </summary>
    public bool AllowSaveDraft { get; private set; }
    
    /// <summary>
    /// نمایش نوار پیشرفت
    /// </summary>
    public bool ShowProgressBar { get; private set; }
    
    /// <summary>
    /// تصادفی کردن ترتیب سوالات
    /// </summary>
    public bool RandomizeQuestions { get; private set; }
    
    /// <summary>
    /// امکان پاسخ‌دهی چندباره
    /// </summary>
    public bool AllowMultipleResponses { get; private set; }
    
    /// <summary>
    /// پیام خوش‌آمدگویی
    /// </summary>
    public string? WelcomeMessage { get; private set; }
    
    /// <summary>
    /// پیام تشکر پس از تکمیل
    /// </summary>
    public string? ThankYouMessage { get; private set; }
    
    /// <summary>
    /// حداکثر تعداد پاسخ
    /// </summary>
    public int? MaxResponses { get; private set; }
    
    /// <summary>
    /// تعداد کل پاسخ‌ها
    /// </summary>
    public int TotalResponses { get; private set; }
    
    /// <summary>
    /// نیاز به ورود برای پاسخ‌دهی
    /// </summary>
    public bool RequireLogin { get; private set; }
    
    /// <summary>
    /// نسخه نظرسنجی (برای تاریخچه تغییرات)
    /// </summary>
    public int Version { get; private set; }
    
    /// <summary>
    /// تاریخ انتشار
    /// </summary>
    public DateTime? PublishedDate { get; private set; }
    
    /// <summary>
    /// GUID کاربری که نظرسنجی را منتشر کرده
    /// </summary>
    public Guid? PublishedBy { get; private set; }
    
    /// <summary>
    /// رنگ تم نظرسنجی
    /// </summary>
    public string? ThemeColor { get; private set; }
    
    /// <summary>
    /// لوگو (URL یا Base64)
    /// </summary>
    public Guid? LogoGuid { get; private set; }
    
    /// <summary>
    /// تصویر پس‌زمینه
    /// </summary>
    public Guid? BackgroundImageGuid { get; private set; }
    
    /// <summary>
    /// Navigation Properties
    /// </summary>
    public ICollection<Question> Questions { get; set; } = [];
    public ICollection<Response> Responses { get; set; } = [];
    public ICollection<SurveyAccessAgg.SurveyAccess> AccessControls { get; set; } = [];
    public ICollection<SurveyChangeLog> ChangeLogs { get; set; } = [];
    public ICollection<SurveyCriterion> Criteria { get; set; }

    /// <summary>
    /// ویرایش نظرسنجی
    /// </summary>
    public void Edit(
        Guid actor,
        string title,
        string description,
        DateTime startDate,
        DateTime endDate,
        AccessType accessType,
        ShowType showType,
        bool allowAnonymous,
        bool allowSaveDraft,
        bool showProgressBar,
        bool randomizeQuestions,
        bool allowMultipleResponses,
        string? welcomeMessage,
        string? thankYouMessage,
        int? maxResponses,
        bool requireLogin)
    {
        Title = title;
        Description = description;
        StartDate = startDate;
        EndDate = endDate;
        AccessType = accessType;
        ShowType = showType;
        AllowAnonymous = allowAnonymous;
        AllowSaveDraft = allowSaveDraft;
        ShowProgressBar = showProgressBar;
        RandomizeQuestions = randomizeQuestions;
        AllowMultipleResponses = allowMultipleResponses;
        WelcomeMessage = welcomeMessage;
        ThankYouMessage = thankYouMessage;
        MaxResponses = maxResponses;
        RequireLogin = requireLogin;
        Version++;
        Modified(actor);
    }
    
    /// <summary>
    /// انتشار نظرسنجی
    /// </summary>
    public void Publish(Guid actor)
    {
        Status = SurveyStatus.Published;
        PublishedDate = DateTime.Now;
        PublishedBy = actor;
        Modified(actor);
    }
    
    /// <summary>
    /// فعال‌سازی نظرسنجی
    /// </summary>
    public void Activate(Guid actor)
    {
        Status = SurveyStatus.Active;
        Modified(actor);
    }
    
    /// <summary>
    /// بستن نظرسنجی
    /// </summary>
    public void Close(Guid actor)
    {
        Status = SurveyStatus.Closed;
        Modified(actor);
    }
    
    /// <summary>
    /// متوقف کردن نظرسنجی
    /// </summary>
    public void Pause(Guid actor)
    {
        Status = SurveyStatus.Paused;
        Modified(actor);
    }
    
    /// <summary>
    /// آرشیو کردن نظرسنجی
    /// </summary>
    public void Archive(Guid actor)
    {
        Status = SurveyStatus.Archived;
        Modified(actor);
    }
    
    /// <summary>
    /// افزایش تعداد پاسخ‌ها
    /// </summary>
    public void IncrementResponseCount()
    {
        TotalResponses++;
    }
    
    /// <summary>
    /// تنظیم تم
    /// </summary>
    public void SetTheme(Guid actor, string? themeColor, Guid? logoGuid, Guid? backgroundImageGuid)
    {
        ThemeColor = themeColor;
        LogoGuid = logoGuid;
        BackgroundImageGuid = backgroundImageGuid;
        Modified(actor);
    }
    
    /// <summary>
    /// بررسی اینکه آیا نظرسنجی فعال است
    /// </summary>
    public bool IsActiveSurvey()
    {
        var now = DateTime.Now;
        return Status == SurveyStatus.Active && 
               StartDate <= now && 
               EndDate >= now &&
               (!MaxResponses.HasValue || TotalResponses < MaxResponses.Value);
    }
    
    /// <summary>
    /// بررسی اینکه آیا کاربر می‌تواند پاسخ دهد
    /// </summary>
    public bool CanRespond()
    {
        return IsActiveSurvey();
    }
}
