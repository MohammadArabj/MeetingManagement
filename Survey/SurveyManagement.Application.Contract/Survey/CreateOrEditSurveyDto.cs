using Epc.Application.Command;
using SurveyManagement.Common;

namespace SurveyManagement.Application.Contract.Survey;

/// <summary>
/// DTO برای ایجاد/ویرایش نظرسنجی
/// </summary>
public record CreateOrEditSurveyDto : ICommand
{
    public Guid? Guid { get; init; }
    public string Title { get; init; }
    public string Description { get; init; }
    public string StartDate { get; init; }
    public string EndDate { get; init; }
    public AccessType AccessType { get; init; }
    public ShowType ShowType { get; set; }
    public bool AllowAnonymous { get; init; }
    public bool AllowSaveDraft { get; init; }
    public bool ShowProgressBar { get; init; }
    public bool RandomizeQuestions { get; init; }
    public bool AllowMultipleResponses { get; init; }
    public string? WelcomeMessage { get; init; }
    public string? ThankYouMessage { get; init; }
    public int? MaxResponses { get; init; }
    public bool RequireLogin { get; init; }
    public string? ThemeColor { get; init; }
    public Guid? LogoGuid { get; init; }
    public Guid? BackgroundImageGuid { get; init; }
}

/// <summary>
/// DTO برای حذف نظرسنجی
/// </summary>
public record DeleteSurveyDto(Guid Guid) : ICommand;

/// <summary>
/// DTO برای انتشار نظرسنجی
/// </summary>
public record PublishSurveyDto(Guid Guid) : ICommand;

/// <summary>
/// DTO برای فعال‌سازی نظرسنجی
/// </summary>
public record ActivateSurveyDto(Guid Guid) : ICommand;

/// <summary>
/// DTO برای بستن نظرسنجی
/// </summary>
public record CloseSurveyDto(Guid Guid) : ICommand;

/// <summary>
/// DTO برای متوقف کردن نظرسنجی
/// </summary>
public record PauseSurveyDto(Guid Guid) : ICommand;

/// <summary>
/// DTO برای آرشیو کردن نظرسنجی
/// </summary>
public record ArchiveSurveyDto(Guid Guid) : ICommand;


public record QuestionForWizardDto
{
    /// <summary>Guid واقعی سوال — فقط برای سوالات از قبل موجود پر می‌شود. برای سوال جدید null است.</summary>
    public Guid? Guid { get; init; }

    /// <summary>✅ اگر true باشد یعنی این سوال باید حذف شود (به همراه پاسخ‌های ثبت‌شده برایش)</summary>
    public bool IsRemoved { get; init; }

    public string QuestionText { get; init; }
    public int QuestionType { get; init; }
    public int SortOrder { get; init; }
    public bool IsRequired { get; init; }
    public string? HelpText { get; init; }
    public string? Placeholder { get; init; }
    public bool? RandomizeOptions { get; init; }
    public bool? AllowOtherOption { get; init; }
    public string? OtherOptionText { get; init; }

    public Guid? ImageGuid { get; init; }
    public string? VideoGuid { get; init; } // ⚠️ چون Question.SetMedia آن را string? می‌خواهد

    public int? ValidationType { get; init; }
    public string? ValidationErrorMessage { get; init; }
    public string? CustomValidationRegex { get; init; }
    public int? MinLength { get; init; }
    public int? MaxLength { get; init; }
    public decimal? MinValue { get; init; }
    public decimal? MaxValue { get; init; }
    public int? MinSelections { get; init; }
    public int? MaxSelections { get; init; }
    public int? MaxFileSize { get; init; }
    public string? AllowedFileTypes { get; init; }
    public string? MinScaleLabel { get; init; }
    public string? MaxScaleLabel { get; init; }
    public List<string>? MatrixRows { get; init; }
    public List<string>? MatrixColumns { get; init; }

    public List<OptionForWizardDto> Options { get; init; } = new();
    public List<LogicForWizardDto> Logics { get; init; } = new();
}

public record OptionForWizardDto
{
    public Guid? Guid { get; init; }
    public bool IsRemoved { get; init; }
    public string OptionText { get; init; }
    public int SortOrder { get; init; }
    public string? Value { get; init; }
    public Guid? ImageGuid { get; init; }
    public string? Color { get; init; }
}

public record LogicForWizardDto
{
    public Guid? Guid { get; init; }
    public bool IsRemoved { get; init; }
    public Guid? TargetQuestionGuid { get; init; }
    public int LogicType { get; init; }
    public int ConditionOperator { get; init; }
    public string? ConditionValue { get; init; }
    public Guid? OptionGuid { get; init; }
    public int Priority { get; init; }
}

public record AccessItemForWizardDto
{
    public Guid? Guid { get; init; }
    public bool IsRemoved { get; init; }
    public TargetType TargetType { get; init; }
    public Guid? TargetGuid { get; init; }
    public bool CanView { get; init; }
    public bool CanRespond { get; init; }
    public bool CanViewResults { get; init; }
    public bool CanEdit { get; init; }
    public bool CanDelete { get; init; }
    public string? ExpirationDate { get; init; }
}

public record CreateSurveyWithQuestionsResponse
{
    public Guid SurveyGuid { get; init; }
    public List<Guid> QuestionGuids { get; init; } = new();
    public string Message { get; init; }
}