using SurveyManagement.Common;

namespace SurveyManagement.Infrastructure.Query.Contract.Survey;

/// <summary>
/// DTO برای جزئیات نظرسنجی
/// </summary>
public class SurveyDetailDto
{
    public long Id { get; set; }
    public Guid Guid { get; set; }
    public string Title { get; set; }
    public string Description { get; set; }
    public string StartDate { get; set; }
    public string EndDate { get; set; }
    public SurveyStatus Status { get; set; }
    public string StatusText { get; set; }
    public AccessType AccessType { get; set; }
    public ShowType ShowType { get; set; }
    public string AccessTypeText { get; set; }
    public bool AllowAnonymous { get; set; }
    public bool AllowSaveDraft { get; set; }
    public bool ShowProgressBar { get; set; }
    public bool RandomizeQuestions { get; set; }
    public bool AllowMultipleResponses { get; set; }
    public string? WelcomeMessage { get; set; }
    public string? ThankYouMessage { get; set; }
    public int? MaxResponses { get; set; }
    public int TotalResponses { get; set; }
    public bool RequireLogin { get; set; }
    public int Version { get; set; }
    public string? PublishedDate { get; set; }
    public string? PublishedBy { get; set; }
    public string? ThemeColor { get; set; }
    public string? CompletionEffect { get; set; }
    public Guid? LogoGuid { get; set; }
    public Guid? BackgroundImageGuid { get; set; }
    public int TotalQuestions { get; set; }
    public string CreatedBy { get; set; }
    public string Created { get; set; }
    public bool HasCriteria { get; set; }
    public List<SurveyCriterionDto> Criteria { get; set; } = new();
}
public class SurveyCriterionDto
{
    public Guid Guid { get; set; }
    public string Title { get; set; }
    public string? Description { get; set; }
    public int SortOrder { get; set; }
}