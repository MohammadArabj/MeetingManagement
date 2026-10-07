

namespace SurveyManagement.Infrastructure.Query.Contract.Response;

/// <summary>
/// DTO برای گزارش خلاصه پاسخ‌ها
/// </summary>
//public class ResponseSummaryDto
//{
//    public Guid SurveyGuid { get; set; }
//    public string SurveyTitle { get; set; }
//    public int TotalResponses { get; set; }
//    public int CompletedResponses { get; set; }
//    public int InProgressResponses { get; set; }
//    public int AnonymousResponses { get; set; }
//    public decimal CompletionRate { get; set; }
//    public decimal AverageTimeSpent { get; set; } // به دقیقه
//    public Dictionary<string, int> ResponsesByDevice { get; set; } = new();
//    public Dictionary<string, int> ResponsesByDate { get; set; } = new();
//}
public class ResponseSummaryDto
{
    public Guid SurveyGuid { get; set; }
    public string SurveyTitle { get; set; } = string.Empty;
    public int TotalResponses { get; set; }
    public decimal AverageTimeSpent { get; set; } // به دقیقه
    public Dictionary<string, int> ResponsesByDate { get; set; } = new();
}