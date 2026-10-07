namespace SurveyManagement.Infrastructure.Query.Contract.Response;

/// <summary>پیش‌نویس کاربر جاری برای ادامه‌ی پاسخ‌دهی از همان نقطه</summary>
public class UserDraftResponseDto
{
    public Guid SurveyGuid { get; set; }
    public int AnsweredCount { get; set; }
    public int TotalQuestions { get; set; }
    public decimal? ProgressPercentage { get; set; }
    public string StartedAt { get; set; } = string.Empty;
    public string LastSavedAt { get; set; } = string.Empty;

    /// <summary>اولین سوال بی‌پاسخ (به ترتیب نظرسنجی)؛ نقطه‌ی ادامه</summary>
    public Guid? ResumeQuestionGuid { get; set; }

    public List<SavedAnswerDto> SavedAnswers { get; set; } = new();
}
