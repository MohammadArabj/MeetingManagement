using SurveyManagement.Common;

namespace SurveyManagement.Infrastructure.Query.Contract.Survey;

/// <summary>
/// ✅ Request برای دریافت Survey + Questions
/// </summary>
public record GetSurveyWithQuestionsRequest(Guid SurveyGuid);

/// <summary>
/// ✅ Response برای دریافت Survey + Questions
/// </summary>
// در GetSurveyWithQuestionsResponse اضافه شود:
public class GetSurveyWithQuestionsResponse
{
    public SurveyForEditDto Survey { get; set; }
    public List<QuestionForEditDto> Questions { get; set; }
    public List<SurveyCriterionEditDto> Criteria { get; set; }

    /// <summary>کاربر جاری می‌تواند ذخیره کند (مدیر سامانه همیشه؛ مالک فقط پیش از انتشار). در غیر این صورت فقط مشاهده</summary>
    public bool CanEdit { get; set; }

    /// <summary>کاربر جاری مدیر سامانه است</summary>
    public bool IsAdmin { get; set; }

    /// <summary>وضعیت نظرسنجی (1 پیش‌نویس، 2 منتشرشده، ...)</summary>
    public int Status { get; set; }
    // ✅ اضافه شود
    public List<AccessItemForEditDto>? AccessItems { get; set; }
}

public class SurveyCriterionEditDto
{
    public Guid Guid { get; set; }          // همیشه پر است (چه جدید چه موجود)
    public string Title { get; set; }
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public bool IsRemoved { get; set; }
    public string TempId { get; set; }
}
public class AccessItemForEditDto
{
    public Guid Guid { get; set; }
    public string TempId { get; set; }
    public TargetType TargetType { get; set; }
    public Guid TargetGuid { get; set; }
    public string TargetName { get; set; }    // resolve از UserManagement
    public string? TargetPosition { get; set; }
    public bool CanView { get; set; }
    public bool CanRespond { get; set; }
    public bool CanViewResults { get; set; }
    public bool CanEdit { get; set; }
    public bool CanDelete { get; set; }
    public string? ExpirationDate { get; set; }
}

/// <summary>
/// DTO برای Survey در Edit Mode
/// </summary>
public class SurveyForEditDto
{
    public Guid Guid { get; set; }
    public string Title { get; set; }
    public string Description { get; set; }
    public string StartDate { get; set; }
    public string EndDate { get; set; }
    public AccessType AccessType { get; set; }
    public ShowType ShowType { get; set; }
    public bool AllowAnonymous { get; set; }
    public bool AllowSaveDraft { get; set; }
    public bool ShowProgressBar { get; set; }
    public bool RandomizeQuestions { get; set; }
    public bool AllowMultipleResponses { get; set; }
    public bool RequireLogin { get; set; }
    public string? WelcomeMessage { get; set; }
    public string? ThankYouMessage { get; set; }
    public int? MaxResponses { get; set; }
    public string? ThemeColor { get; set; }
    public string? CompletionEffect { get; set; }
    public Guid? LogoGuid { get; set; } // ✅ GUID به جای URL
    public Guid? BackgroundImageGuid { get; set; } // ✅ GUID به جای URL
    public bool HasCriteria { get; set; }
}

/// <summary>
/// DTO برای Question در Edit Mode
/// </summary>
public class QuestionForEditDto
{
    public Guid Guid { get; set; }
    public string TempId { get; set; } // برای Frontend tracking
    public string QuestionText { get; set; }
    public QuestionType QuestionType { get; set; }
    public int SortOrder { get; set; }
    public bool IsRequired { get; set; }
    public string? HelpText { get; set; }
    public string? Placeholder { get; set; }
    
    // Media
    public Guid? ImageGuid { get; set; }
    public string? VideoGuid { get; set; }
    
    // Validation
    public ValidationType? ValidationType { get; set; }
    public string? ValidationErrorMessage { get; set; }
    public string? ValidationRegex { get; set; }
    public int? MinLength { get; set; }
    public int? MaxLength { get; set; }
    public decimal? MinValue { get; set; }
    public decimal? MaxValue { get; set; }
    
    // Selection
    public int? MinSelection { get; set; }
    public int? MaxSelection { get; set; }
    
    // File Upload
    public int? MaxFileSize { get; set; }
    public string? AllowedFileTypes { get; set; }
    
    // Scale
    public string? MinScaleLabel { get; set; }
    public string? MaxScaleLabel { get; set; }
    
    // Matrix
    public string? MatrixRowsJson { get; set; }
    public string? MatrixColumnsJson { get; set; }
    
    // Other
    public bool RandomizeOptions { get; set; }
    public bool AllowOtherOption { get; set; }
    public string? OtherOptionText { get; set; }
    
    // Options
    public List<QuestionOptionForEditDto>? Options { get; set; }
    
    // Logic (optional - برای آینده)
    public List<QuestionLogicForEditDto>? LogicRules { get; set; }
    public Guid? CriterionGuid { get; set; }
}

/// <summary>
/// DTO برای Option در Edit Mode
/// </summary>
public class QuestionOptionForEditDto
{
    public Guid Guid { get; set; }
    public string TempId { get; set; }
    public string OptionText { get; set; }
    public int SortOrder { get; set; }
    public string? Value { get; set; }
    public Guid? ImageGuid { get; set; } // ✅ GUID
    public string? Color { get; set; }
}

/// <summary>
/// DTO برای Logic در Edit Mode
/// </summary>
public class QuestionLogicForEditDto
{
    public Guid Guid { get; set; }
    public Guid TargetQuestionGuid { get; set; }
    public LogicType LogicType { get; set; }
    public ConditionOperator ConditionOperator { get; set; }
    public string? ConditionValue { get; set; }
    public Guid? SelectedOptionGuid { get; set; }
    public int Priority { get; set; }
}
