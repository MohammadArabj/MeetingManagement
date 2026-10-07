namespace SurveyManagement.Infrastructure.Query.Contract.Response;

public class ResponseListDto
{
    public Guid Guid { get; set; }
    public Guid SurveyGuid { get; set; }
    public string SurveyTitle { get; set; } = string.Empty;

    public int? Age { get; set; }
    public string? Gender { get; set; }
    public string? Office { get; set; }
    public string? EmploymentType { get; set; }
    public string? Education { get; set; }
    public string? ShiftWorker { get; set; }
    public int? ExperienceYears { get; set; }
    public string? OrganizationalGrade { get; set; }
    public string? OrganizationalGroup { get; set; }

    public string StartedAt { get; set; } = string.Empty;
    public string? CompletedAt { get; set; }
    public int? TimeSpentSeconds { get; set; }
    public string? TimeSpentText { get; set; }
}
