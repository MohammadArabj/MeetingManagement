namespace SurveyManagement.Infrastructure.Query.Contract.Response;

/// <summary>پاسخ ذخیره‌شده‌ی یک سوال در پیش‌نویس (هم‌شکل ResponseAnswerDto ارسالی کلاینت)</summary>
public class SavedAnswerDto
{
    public Guid QuestionGuid { get; set; }
    public string? TextAnswer { get; set; }
    public decimal? NumericAnswer { get; set; }
    public string? DateAnswer { get; set; }
    public Guid? SelectedOptionGuid { get; set; }
    public List<Guid>? SelectedOptionGuids { get; set; }
    public string? OtherAnswer { get; set; }
    public string? FileUrl { get; set; }
    public string? FileName { get; set; }
    public long? FileSize { get; set; }
    public Dictionary<string, string>? MatrixAnswers { get; set; }
    public List<int>? RankingAnswers { get; set; }
    public string AnsweredAt { get; set; } = string.Empty;
}
