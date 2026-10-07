using Epc.Domain;
using SurveyManagement.Common;
using SurveyManagement.Domain.SurveyAgg;

namespace SurveyManagement.Domain.ResponseAgg;

public class Response
{
    public Response() { } // EF Core

    public Response(
        long surveyId,
        int? age,
        string? gender,
        string? office,
        string? employmentType,
        string? education,
        string? shiftWorker,
        int? experienceYears,
        string? organizationalGrade,
        string? organizationalGroup)
    {
        Guid = Guid.NewGuid();
        SurveyId = surveyId;
        Status = ResponseStatus.Completed;
        StartedAt = DateTime.Now;

        Age = age;
        Gender = gender;
        Office = office;
        EmploymentType = employmentType;
        Education = education;
        ShiftWorker = shiftWorker;
        ExperienceYears = experienceYears;
        OrganizationalGrade = organizationalGrade;
        OrganizationalGroup = organizationalGroup;
    }

    public long Id { get; set; }
    public Guid Guid { get; private set; }
    public ResponseStatus Status { get; private set; }
    public DateTime StartedAt { get; private set; }
    public DateTime? CompletedAt { get; private set; }
    public int? TimeSpentSeconds { get; private set; }

    // ===== دموگرافیک — مقادیر مستقیم از vwPersonelInfo، بدون bucketing =====
    public int? Age { get; private set; }
    public string? Gender { get; private set; }
    public string? Office { get; private set; }
    public string? EmploymentType { get; private set; }
    public string? Education { get; private set; }
    public string? ShiftWorker { get; private set; }
    public int? ExperienceYears { get; private set; }
    public string? OrganizationalGrade { get; private set; }
    public string? OrganizationalGroup { get; private set; }

    public long SurveyId { get; private set; }
    public Survey Survey { get; set; }
    public ICollection<ResponseAnswer> Answers { get; set; } = new List<ResponseAnswer>();

    public void Complete()
    {
        CompletedAt = DateTime.Now;
        TimeSpentSeconds = (int)(CompletedAt.Value - StartedAt).TotalSeconds;
    }
}
