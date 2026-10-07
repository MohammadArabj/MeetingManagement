using Epc.Application.Command;
using SurveyManagement.Common;

namespace SurveyManagement.Application.Contract.Question;

/// <summary>
/// DTO برای ایجاد/ویرایش سوال
/// </summary>
public record CreateOrEditQuestionDto : ICommand
{
    public Guid? Guid { get; init; }
    public Guid SurveyGuid { get; init; }
    public string QuestionText { get; init; }
    public QuestionType QuestionType { get; init; }
    public int SortOrder { get; init; }
    public bool IsRequired { get; init; }
    public string? HelpText { get; init; }
    public string? Placeholder { get; init; }
    public bool RandomizeOptions { get; init; }
    public bool AllowOtherOption { get; init; }
    public string? OtherOptionText { get; init; }
    public Guid? ImageUrl { get; init; }
    public string? VideoUrl { get; init; }

    // Validation
    public ValidationType ValidationType { get; init; }
    public string? ValidationErrorMessage { get; init; }
    public string? CustomValidationRegex { get; init; }
    public int? MinLength { get; init; }
    public int? MaxLength { get; init; }
    public decimal? MinValue { get; init; }
    public decimal? MaxValue { get; init; }
    public int? MinSelections { get; init; }
    public int? MaxSelections { get; init; }

    // File Upload
    public int? MaxFileSize { get; init; }
    public string? AllowedFileTypes { get; init; }

    // Scale Labels
    public string? MinScaleLabel { get; init; }
    public string? MaxScaleLabel { get; init; }

    // Matrix
    public string? MatrixRows { get; init; }
    public string? MatrixColumns { get; init; }

    // Options
    public List<QuestionOptionDto> Options { get; init; } = new();

    // Logic
    public List<QuestionLogicDto> Logics { get; init; } = new();
}

/// <summary>
/// DTO برای گزینه سوال
/// </summary>
public record QuestionOptionDto
{
    public Guid? Guid { get; init; }
    public string OptionText { get; init; }
    public int SortOrder { get; init; }
    public decimal? Value { get; init; }
    public string? ImageUrl { get; init; }
    public string? Color { get; init; }
    public bool IsRemoved { get; init; }
}

/// <summary>
/// DTO برای منطق شرطی سوال
/// </summary>
public record QuestionLogicDto
{
    public Guid? Guid { get; init; }
    public Guid? TargetQuestionGuid { get; init; }
    public LogicType LogicType { get; init; }
    public ConditionOperator ConditionOperator { get; init; }
    public string? ConditionValue { get; init; }
    public Guid? OptionGuid { get; init; }
    public int Priority { get; init; }
    public bool IsRemoved { get; init; }
}

/// <summary>
/// DTO برای حذف سوال
/// </summary>
public record DeleteQuestionDto(Guid Guid) : ICommand;

/// <summary>
/// DTO برای تغییر ترتیب سوالات
/// </summary>
public record ReorderQuestionsDto : ICommand
{
    public Guid SurveyGuid { get; init; }
    public List<QuestionOrderItem> Orders { get; init; } = new();
}

public record QuestionOrderItem(Guid QuestionGuid, int NewSortOrder);



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
    public decimal? Value { get; init; }
    public string? ImageGuid { get; init; }
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