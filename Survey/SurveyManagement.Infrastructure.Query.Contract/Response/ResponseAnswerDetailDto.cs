
using SurveyManagement.Common;

namespace SurveyManagement.Infrastructure.Query.Contract.Response;

/// <summary>
/// DTO برای پاسخ به هر سوال
/// </summary>
public class ResponseAnswerDetailDto
{
    public long Id { get; set; }
    public Guid QuestionGuid { get; set; }
    public string QuestionText { get; set; }
    public QuestionType QuestionType { get; set; }
    public string? TextAnswer { get; set; }
    public decimal? NumericAnswer { get; set; }
    public string? DateAnswer { get; set; }
    public string? SelectedOption { get; set; } // متن گزینه انتخاب شده
    public List<string>? SelectedOptions { get; set; } // متن گزینه‌های انتخاب شده
    public string? OtherAnswer { get; set; }
    public string? FileUrl { get; set; }
    public string? FileName { get; set; }
    public Dictionary<string, string>? MatrixAnswers { get; set; }
    public List<string>? RankingAnswers { get; set; }
    public string AnsweredAt { get; set; }
    public int? TimeSpentSeconds { get; set; }
    public bool IsSkipped { get; set; }
}
