
namespace SurveyManagement.Infrastructure.Query.Contract.Response;

/// <summary>
/// DTO برای export پاسخ‌ها به Excel
/// </summary>
public class ResponseExportDto
{
    public string RespondentName { get; set; }
    public string Status { get; set; }
    public string CompletedAt { get; set; }
    public string TimeSpent { get; set; }
    public Dictionary<string, string> Answers { get; set; } = new(); // QuestionText -> Answer
}
