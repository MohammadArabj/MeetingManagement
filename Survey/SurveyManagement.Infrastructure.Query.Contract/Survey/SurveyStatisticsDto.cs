using SurveyManagement.Infrastructure.Query.Contract.Response;

namespace SurveyManagement.Infrastructure.Query.Contract.Survey;

public class SurveyStatisticsDto
{
    public Guid SurveyGuid { get; set; }
    public string Title { get; set; } = string.Empty;
    public int TotalQuestions { get; set; }
    public int TotalResponses { get; set; }
    public decimal AverageTimeSpent { get; set; }
    public Dictionary<string, int> ResponsesByDate { get; set; } = new();

    public List<DemographicBucketDto> ResponsesByAge { get; set; } = new();
    public List<DemographicBucketDto> ResponsesByGender { get; set; } = new();
    public List<DemographicBucketDto> ResponsesByOffice { get; set; } = new();
    public List<DemographicBucketDto> ResponsesByEmploymentType { get; set; } = new();
    public List<DemographicBucketDto> ResponsesByEducation { get; set; } = new();
    public List<DemographicBucketDto> ResponsesByShiftWorker { get; set; } = new();
    public List<DemographicBucketDto> ResponsesByExperienceYears { get; set; } = new();
    public List<DemographicBucketDto> ResponsesByOrganizationalGrade { get; set; } = new();
    public List<DemographicBucketDto> ResponsesByOrganizationalGroup { get; set; } = new();
}