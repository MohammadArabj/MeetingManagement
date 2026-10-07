using SurveyManagement.Common;

namespace SurveyManagement.Infrastructure.Query.Contract.Survey;

/// <summary>
/// Request برای جستجوی نظرسنجی‌ها
/// </summary>
public record SurveySearchRequest
{
    public string? Title { get; init; }
    public SurveyStatus? Status { get; init; }
    public AccessType? AccessType { get; init; }
    public Guid? CreatorUserGuid { get; init; }
    public bool? AllowAnonymous { get; init; }
    public string? StartDateFrom { get; init; }
    public string? StartDateTo { get; init; }
    public string? EndDateFrom { get; init; }
    public string? EndDateTo { get; init; }
    public int PageNumber { get; init; } = 1;
    public int PageSize { get; init; } = 10;
}
