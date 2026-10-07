using Epc.Domain;
using SurveyManagement.Common;
using SurveyManagement.Domain.SurveyCriterionAgg;

namespace SurveyManagement.Domain.QuestionAgg;

/// <summary>
/// سوال نظرسنجی
/// </summary>
public class Question : AuditableAggregateRootBase<long>
{
    public Question() { } // برای EF Core

    public Question(
        Guid creator,
        long surveyId,
        string questionText,
        QuestionType questionType,
        int sortOrder,
        bool isRequired,
        string? helpText,
        string? placeholder)
        : base(creator)
    {
        Guid = Guid.NewGuid();
        SurveyId = surveyId;
        QuestionText = questionText;
        QuestionType = questionType;
        SortOrder = sortOrder;
        IsRequired = isRequired;
        HelpText = helpText;
        Placeholder = placeholder;
    }

    public Guid Guid { get; private set; }
    
    /// <summary>
    /// شناسه نظرسنجی
    /// </summary>
    public long SurveyId { get; private set; }
    
    /// <summary>
    /// متن سوال
    /// </summary>
    public string QuestionText { get; private set; }
    
    /// <summary>
    /// نوع سوال
    /// </summary>
    public QuestionType QuestionType { get; private set; }
    
    /// <summary>
    /// ترتیب نمایش
    /// </summary>
    public int SortOrder { get; private set; }
    
    /// <summary>
    /// اجباری بودن سوال
    /// </summary>
    public bool IsRequired { get; private set; }
    
    /// <summary>
    /// متن راهنما
    /// </summary>
    public string? HelpText { get; private set; }
    
    /// <summary>
    /// Placeholder برای فیلدهای ورودی
    /// </summary>
    public string? Placeholder { get; private set; }
    
    /// <summary>
    /// تصادفی کردن ترتیب گزینه‌ها
    /// </summary>
    public bool RandomizeOptions { get; private set; }
    
    /// <summary>
    /// نمایش گزینه "سایر" با فیلد متنی
    /// </summary>
    public bool AllowOtherOption { get; private set; }
    
    /// <summary>
    /// متن گزینه "سایر"
    /// </summary>
    public string? OtherOptionText { get; private set; }
    
    /// <summary>
    /// تصویر سوال (URL یا Base64)
    /// </summary>
    public Guid? ImageUrl { get; private set; }
    
    /// <summary>
    /// ویدیو سوال (URL)
    /// </summary>
    public string? VideoUrl { get; private set; }
    
    /// <summary>
    /// نوع اعتبارسنجی
    /// </summary>
    public ValidationType ValidationType { get; private set; }
    
    /// <summary>
    /// پیام خطای اعتبارسنجی سفارشی
    /// </summary>
    public string? ValidationErrorMessage { get; private set; }
    
    /// <summary>
    /// Regex سفارشی برای اعتبارسنجی
    /// </summary>
    public string? CustomValidationRegex { get; private set; }
    
    /// <summary>
    /// حداقل طول متن (برای سوالات متنی)
    /// </summary>
    public int? MinLength { get; private set; }
    
    /// <summary>
    /// حداکثر طول متن (برای سوالات متنی)
    /// </summary>
    public int? MaxLength { get; private set; }
    
    /// <summary>
    /// حداقل مقدار (برای سوالات عددی/امتیازی)
    /// </summary>
    public decimal? MinValue { get; private set; }
    
    /// <summary>
    /// حداکثر مقدار (برای سوالات عددی/امتیازی)
    /// </summary>
    public decimal? MaxValue { get; private set; }
    
    /// <summary>
    /// حداقل تعداد انتخاب (برای چند گزینه‌ای)
    /// </summary>
    public int? MinSelections { get; private set; }
    
    /// <summary>
    /// حداکثر تعداد انتخاب (برای چند گزینه‌ای)
    /// </summary>
    public int? MaxSelections { get; private set; }
    
    /// <summary>
    /// حداکثر حجم فایل به مگابایت (برای آپلود فایل)
    /// </summary>
    public int? MaxFileSize { get; private set; }
    
    /// <summary>
    /// فرمت‌های مجاز فایل (برای آپلود فایل)
    /// مثال: ".pdf,.jpg,.png"
    /// </summary>
    public string? AllowedFileTypes { get; private set; }
    
    /// <summary>
    /// برچسب برای حداقل مقیاس (برای Linear Scale)
    /// </summary>
    public string? MinScaleLabel { get; private set; }
    
    /// <summary>
    /// برچسب برای حداکثر مقیاس (برای Linear Scale)
    /// </summary>
    public string? MaxScaleLabel { get; private set; }
    
    /// <summary>
    /// ردیف‌های ماتریس (برای سوالات ماتریسی) - JSON Array
    /// </summary>
    public string? MatrixRows { get; private set; }
    
    /// <summary>
    /// ستون‌های ماتریس (برای سوالات ماتریسی) - JSON Array
    /// </summary>
    public string? MatrixColumns { get; private set; }

    /// <summary>
    /// Navigation Properties
    /// </summary>
    /// // ---- این property را کنار سایر propertyها اضافه کن ----

    /// <summary>
    /// شناسه معیار مرتبط (اختیاری — اگر نظرسنجی معیار محور نباشد یا سوال به معیاری تعلق نداشته باشد، null است)
    /// </summary>
    public long? CriterionId { get; private set; }

    /// <summary>
    /// Navigation Property به معیار
    /// </summary>
    public SurveyCriterion? Criterion { get; set; }
    public SurveyAgg.Survey Survey { get; set; }
    public ICollection<QuestionOption> Options { get; set; } = new List<QuestionOption>();
    public ICollection<QuestionLogic> QuestionLogics { get; set; } = new List<QuestionLogic>();
    
    /// <summary>
    /// ویرایش سوال
    /// </summary>
    public void Edit(
        Guid actor,
        string questionText,
        QuestionType questionType,
        int sortOrder,
        bool isRequired,
        string? helpText,
        string? placeholder)
    {
        QuestionText = questionText;
        QuestionType = questionType;
        SortOrder = sortOrder;
        IsRequired = isRequired;
        HelpText = helpText;
        Placeholder = placeholder;
        Modified(actor);
    }
    
    /// <summary>
    /// تنظیم اعتبارسنجی
    /// </summary>
    public void SetValidation(
        Guid actor,
        ValidationType validationType,
        string? validationErrorMessage,
        string? customValidationRegex,
        int? minLength,
        int? maxLength,
        decimal? minValue,
        decimal? maxValue)
    {
        ValidationType = validationType;
        ValidationErrorMessage = validationErrorMessage;
        CustomValidationRegex = customValidationRegex;
        MinLength = minLength;
        MaxLength = maxLength;
        MinValue = minValue;
        MaxValue = maxValue;
        Modified(actor);
    }
    
    /// <summary>
    /// تنظیم محدودیت‌های انتخاب
    /// </summary>
    public void SetSelectionLimits(Guid actor, int? minSelections, int? maxSelections)
    {
        MinSelections = minSelections;
        MaxSelections = maxSelections;
        Modified(actor);
    }
    
    /// <summary>
    /// تنظیم گزینه‌های مدیا
    /// </summary>
    public void SetMedia(Guid actor, Guid? imageUrl, string? videoUrl)
    {
        ImageUrl = imageUrl;
        VideoUrl = videoUrl;
        Modified(actor);
    }
    
    /// <summary>
    /// تنظیم گزینه "سایر"
    /// </summary>
    public void SetOtherOption(Guid actor, bool allowOtherOption, string? otherOptionText)
    {
        AllowOtherOption = allowOtherOption;
        OtherOptionText = otherOptionText;
        Modified(actor);
    }
    
    /// <summary>
    /// تنظیم تصادفی‌سازی گزینه‌ها
    /// </summary>
    public void SetRandomizeOptions(Guid actor, bool randomizeOptions)
    {
        RandomizeOptions = randomizeOptions;
        Modified(actor);
    }
    
    /// <summary>
    /// تنظیم محدودیت‌های فایل
    /// </summary>
    public void SetFileConstraints(Guid actor, int? maxFileSize, string? allowedFileTypes)
    {
        MaxFileSize = maxFileSize;
        AllowedFileTypes = allowedFileTypes;
        Modified(actor);
    }
    
    /// <summary>
    /// تنظیم برچسب‌های مقیاس
    /// </summary>
    public void SetScaleLabels(Guid actor, string? minScaleLabel, string? maxScaleLabel)
    {
        MinScaleLabel = minScaleLabel;
        MaxScaleLabel = maxScaleLabel;
        Modified(actor);
    }
    // ---- این متد را کنار سایر متدهای Set... اضافه کن ----

    /// <summary>
    /// تعیین یا تغییر معیار مرتبط با سوال
    /// </summary>
    public void SetCriterion(Guid actor, long? criterionId)
    {
        CriterionId = criterionId;
        Modified(actor);
    }
    /// <summary>
    /// تنظیم ماتریس
    /// </summary>
    public void SetMatrix(Guid actor, string? matrixRows, string? matrixColumns)
    {
        MatrixRows = matrixRows;
        MatrixColumns = matrixColumns;
        Modified(actor);
    }
    
    /// <summary>
    /// تغییر ترتیب
    /// </summary>
    public void ChangeSortOrder(Guid actor, int newSortOrder)
    {
        SortOrder = newSortOrder;
        Modified(actor);
    }
}
