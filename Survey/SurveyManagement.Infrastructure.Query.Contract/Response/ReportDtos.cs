namespace SurveyManagement.Infrastructure.Query.Contract.Response;

public class ResponseMatrixDto
{
    public Guid SurveyGuid { get; set; }
    public string SurveyTitle { get; set; } = string.Empty;
    public List<MatrixQuestionColumnDto> Questions { get; set; } = new();
    public List<MatrixResponseRowDto> Rows { get; set; } = new();
}

public class MatrixQuestionColumnDto
{
    public Guid QuestionGuid { get; set; }
    public string QuestionText { get; set; } = string.Empty;
    public int QuestionType { get; set; }
    public int OrderIndex { get; set; }
    public bool IsRequired { get; set; }
}

public class MatrixResponseRowDto
{
    public Guid ResponseGuid { get; set; }

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
    public string? TimeSpentText { get; set; }

    public Dictionary<string, string> Answers { get; set; } = new();
}

public record GetResponseMatrixRequest(Guid SurveyGuid, int? Status = null);

public class ExportResponsesRequestDto
{
    public Guid SurveyGuid { get; set; }
    public int? Status { get; set; }

    /// <summary>
    /// کلید ستون‌ها به ترتیب دلخواه کاربر.
    /// کلیدهای ثابت: index, age, gender, office, employmentType, education, shiftWorker,
    /// experienceYears, organizationalGrade, organizationalGroup, startedAt, completedAt, timeSpent
    /// کلیدهای سوال: QuestionGuid به‌صورت رشته
    /// </summary>
    public List<string> Columns { get; set; } = new();
}
public class ExportParticipantsRequestDto
{
    public Guid SurveyGuid { get; set; }
}

