using SurveyManagement.Common;

namespace SurveyManagement.Infrastructure.Query.Contract.Response;

/// <summary>
/// Request برای جستجوی پاسخ‌ها
/// </summary>

public class ResponseSearchRequest
{
    public Guid SurveyGuid { get; set; }
    public string? CompletedDateFrom { get; set; }
    public string? CompletedDateTo { get; set; }

    public string? Gender { get; set; }
    public string? Office { get; set; }
    public string? EmploymentType { get; set; }
    public string? Education { get; set; }
    public string? ShiftWorker { get; set; }
    public string? OrganizationalGrade { get; set; }
    public string? OrganizationalGroup { get; set; }

    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}
