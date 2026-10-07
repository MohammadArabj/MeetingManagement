namespace SurveyManagement.Domain.Shared.Acls.UserManagement;

// UserManagement.Domain.Shared.Acls.UserManagement
public class UserDemographicViewHelper
{
    public string? AgeGroup { get; set; }
    public string? Gender { get; set; }
    public string? Shift { get; set; }
    public string? UnitTitle { get; set; }
    public int? Age { get; set; }
    public string? OrganizationalGroup { get; set; }
    public string? OrganizationalGrade { get; set; }
    public int? ExperienceYears { get; set; }
    public string? ShiftWorker { get; set; }
    public string? Education { get; set; }
    public string? EmploymentType { get; set; }
    public string? Office { get; set; }
}
public record GetUserDemographicsRequest(Guid UserGuid);