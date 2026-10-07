using SurveyManagement.Common;

namespace SurveyManagement.Infrastructure.Query.Contract.Survey;

/// <summary>
/// DTO برای جستجوی نظرسنجی‌ها
/// </summary>
public class SurveySearchRequestDto
{
    public string? Title { get; set; }
    public SurveyStatus? Status { get; set; }
    public AccessType? AccessType { get; set; }
    public string? StartDateFrom { get; set; }
    public string? StartDateTo { get; set; }
    public string? EndDateFrom { get; set; }
    public string? EndDateTo { get; set; }
    public Guid? CreatorUserGuid { get; set; }
    public bool? AllowAnonymous { get; set; }
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 10;
}
