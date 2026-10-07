
using SurveyManagement.Common;

namespace SurveyManagement.Infrastructure.Query.Contract.Response;

/// <summary>
/// DTO برای جستجوی پاسخ‌ها
/// </summary>
public class ResponseSearchRequestDto
{
    public long SurveyId { get; set; }
    public ResponseStatus? Status { get; set; }
    public bool? IsAnonymous { get; set; }
    public string? CompletedDateFrom { get; set; }
    public string? CompletedDateTo { get; set; }
    public Guid? RespondentUserGuid { get; set; }
    public string? DeviceType { get; set; }
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 10;
}
