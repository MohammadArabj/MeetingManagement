using SurveyManagement.Common;

namespace SurveyManagement.Infrastructure.Query.Contract.Survey;

/// <summary>
/// DTO نظرسنجی عمومی برای پاسخ‌دهی
/// </summary>
public class PublicSurveyDto
{
    public Guid Guid { get; set; }
    public string Title { get; set; }
    public string Description { get; set; }
    public string? WelcomeMessage { get; set; }
    public string? ThankYouMessage { get; set; }
    public string? ThemeColor { get; set; }
    public string? CompletionEffect { get; set; }
    public Guid? LogoGuid { get; set; }
    public Guid? BackgroundImageGuid { get; set; }
    
    public bool AllowAnonymous { get; set; }
    public bool AllowSaveDraft { get; set; }
    public bool ShowProgressBar { get; set; }
    public bool RandomizeQuestions { get; set; }
    public bool AllowMultipleResponses { get; set; }
    public bool RequireLogin { get; set; }
    
    public int TotalQuestions { get; set; }
    public int? MaxResponses { get; set; }
    public int TotalResponses { get; set; }
    
    public string StartDate { get; set; }
    public string EndDate { get; set; }
    
    public bool IsActive { get; set; }
    public bool IsExpired { get; set; }
    public bool IsFull { get; set; }

    /// <summary>1 = اسلایدی (گام‌به‌گام)، 2 = یک‌صفحه‌ای</summary>
    public int ShowType { get; set; }

    /// <summary>نظرسنجی گام‌بندی (معیار) دارد</summary>
    public bool HasCriteria => Criteria.Count > 0;

    /// <summary>گام‌ها/معیارهای نظرسنجی به ترتیب</summary>
    public List<PublicCriterionDto> Criteria { get; set; } = new();

    public List<PublicQuestionDto> Questions { get; set; } = new();
}

/// <summary>گام (معیار) نظرسنجی</summary>
public class PublicCriterionDto
{
    public Guid Guid { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
}

/// <summary>منطق شرطی سوال (برای اجرا در صفحه‌ی پاسخ‌دهی)</summary>
public class PublicLogicDto
{
    public Guid? TargetQuestionGuid { get; set; }
    /// <summary>1 نمایش، 2 پنهان، 3 پرش به سوال، 4 پایان</summary>
    public int LogicType { get; set; }
    /// <summary>1 برابر، 2 نابرابر، 3 شامل، 4 شامل‌نبودن، 5 بزرگ‌تر، 6 کوچک‌تر، 7 پاسخ داده شده، 8 پاسخ داده نشده</summary>
    public int ConditionOperator { get; set; }
    public string? ConditionValue { get; set; }
    public Guid? OptionGuid { get; set; }
    public int Priority { get; set; }
}

/// <summary>
/// DTO سوال برای نمایش عمومی
/// </summary>
public class PublicQuestionDto
{
    public Guid Guid { get; set; }
    public string QuestionText { get; set; }
    public QuestionType QuestionType { get; set; }
    public string QuestionTypeName { get; set; }
    public int SortOrder { get; set; }
    public bool IsRequired { get; set; }
    public string? HelpText { get; set; }
    public string? Placeholder { get; set; }
    public Guid? ImageUrl { get; set; }
    public string? VideoUrl { get; set; }
    
    // Validation
    public ValidationType? ValidationType { get; set; }
    public string? ValidationErrorMessage { get; set; }
    public int? MinLength { get; set; }
    public int? MaxLength { get; set; }
    public decimal? MinValue { get; set; }
    public decimal? MaxValue { get; set; }
    
    // Options
    public List<PublicOptionDto>? Options { get; set; }
    public bool RandomizeOptions { get; set; }
    public bool AllowOtherOption { get; set; }
    public string? OtherOptionText { get; set; }
    
    // Scale
    public string? MinScaleLabel { get; set; }
    public string? MaxScaleLabel { get; set; }
    
    // Matrix
    public string? MatrixRowsJson { get; set; }
    public string? MatrixColumnsJson { get; set; }
    
    // File Upload
    public int? MaxFileSize { get; set; }
    public string? AllowedFileTypes { get; set; }

    public Guid? CriterionGuid { get; set; }
    public int? MinSelections { get; set; }
    public int? MaxSelections { get; set; }
    public string? CustomValidationRegex { get; set; }
    public List<string> MatrixRows { get; set; } = new();
    public List<string> MatrixColumns { get; set; } = new();
    public List<PublicLogicDto> Logics { get; set; } = new();
}

/// <summary>
/// DTO گزینه برای نمایش عمومی
/// </summary>
public class PublicOptionDto
{
    public Guid Guid { get; set; }
    public string OptionText { get; set; }
    public int SortOrder { get; set; }
    public string? Value { get; set; }
    public Guid? ImageUrl { get; set; }
    public string? Color { get; set; }
}

/// <summary>
/// Request برای دریافت نظرسنجی عمومی
/// </summary>
public record GetPublicSurveyRequest(Guid SurveyGuid);

/// <summary>
/// DTO لینک عمومی نظرسنجی
/// </summary>
public class SurveyPublicLinkDto
{
    public Guid SurveyGuid { get; set; }
    public string Title { get; set; }
    public string PublicUrl { get; set; }
    public string QRCodeBase64 { get; set; } // تصویر QR Code به صورت Base64
    public bool IsActive { get; set; }
    public string Status { get; set; }
    public string StartDate { get; set; }
    public string EndDate { get; set; }
}

/// <summary>
/// Request برای دریافت لینک عمومی
/// </summary>
public record GetSurveyPublicLinkRequest(Guid SurveyGuid);
