using Epc.Application.Command;
using SurveyManagement.Common;

namespace SurveyManagement.Application.Contract.Survey;

/// <summary>
/// DTO برای ایجاد/ویرایش نظرسنجی همراه با سوالات (Wizard)
/// </summary>
public record CreateSurveyWithQuestionsDto : ICommand
{
    public SurveyInfoDto Survey { get; init; }
    public List<QuestionDto> Questions { get; init; }
    public List<SurveyAccessItemDto>? AccessItems { get; set; }
    public List<SurveyCriterionDto>? Criteria { get; set; }

}
public class SurveyCriterionDto
{
    public Guid Guid { get; set; }          // همیشه پر است (چه جدید چه موجود)
    public string Title { get; set; }
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public bool IsRemoved { get; set; }
}
public class SurveyAccessItemDto
{
    public TargetType TargetType { get; set; } // همیشه User (چون واحد در فرانت resolve شده)
    public Guid TargetGuid { get; set; }
    public bool CanView { get; set; }
    public bool CanRespond { get; set; }
    public bool CanViewResults { get; set; }
    public bool CanEdit { get; set; }
    public bool CanDelete { get; set; }
    public string? ExpirationDate { get; set; }
    public bool IsRemoved { get; set; }
    public Guid? Guid { get; set; }
}
/// <summary>
/// اطلاعات نظرسنجی
/// </summary>
public record SurveyInfoDto
{
    public Guid? Guid { get; init; }
    public string Title { get; init; }
    public string Description { get; init; }
    public string StartDate { get; init; }
    public string EndDate { get; init; }
    public AccessType AccessType { get; init; }
    public ShowType ShowType { get; init; }
    public bool AllowAnonymous { get; init; }
    public bool AllowSaveDraft { get; init; }
    public bool ShowProgressBar { get; init; }
    public bool RandomizeQuestions { get; init; }
    public bool AllowMultipleResponses { get; init; }
    public bool RequireLogin { get; init; }
    public string? WelcomeMessage { get; init; }
    public string? ThankYouMessage { get; init; }
    public int? MaxResponses { get; init; }
    public string? ThemeColor { get; init; }

    // ✅ تغییر به GUID
    public Guid? LogoGuid { get; init; }
    public Guid? BackgroundImageGuid { get; init; }
}

/// <summary>
/// اطلاعات سوال
/// </summary>
public record QuestionDto
{
    public Guid? Guid { get; init; }
    public string QuestionText { get; init; }
    public int QuestionType { get; init; }
    public int SortOrder { get; init; }
    public bool IsRequired { get; init; }

    public string? HelpText { get; init; }
    public string? Placeholder { get; init; }

    public List<QuestionOptionDto>? Options { get; init; }

    public bool? RandomizeOptions { get; init; }
    public bool? AllowOtherOption { get; init; }
    public string? OtherOptionText { get; init; }

    // ✅ تغییر به GUID
    public Guid? ImageGuid { get; init; }
    public string? VideoGuid { get; init; }

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

    public List<QuestionLogicDto>? Logics { get; init; }
    public bool IsRemoved { get; set; }
    public Guid? CriterionGuid { get; set; }
}

/// <summary>
/// اطلاعات گزینه سوال
/// </summary>
public record QuestionOptionDto
{
    public Guid? Guid { get; init; }
    public string OptionText { get; init; }
    public int SortOrder { get; init; }
    public string? Value { get; init; }

    // ✅ تغییر به GUID
    public Guid? ImageGuid { get; init; }
    public string? Color { get; init; }
    public bool IsRemoved { get; set; }
}

/// <summary>
/// اطلاعات منطق شرطی سوال
/// </summary>
public record QuestionLogicDto
{
    public Guid? Guid { get; init; }
    public Guid? TargetQuestionGuid { get; init; }
    public int LogicType { get; init; }
    public int ConditionOperator { get; init; }
    public string? ConditionValue { get; init; }
    public Guid? OptionGuid { get; init; }
    public int Priority { get; init; }
    public bool IsRemoved { get; set; }
}

