

namespace SurveyManagement.Infrastructure.Query.Contract.Response;

public class SavedAnswerDto
{
    public Guid QuestionGuid { get; set; }
    public string? TextAnswer { get; set; }
    public decimal? NumericAnswer { get; set; }
    public string? DateAnswer { get; set; }
    public long? SelectedOptionId { get; set; }
    public List<long>? SelectedOptionIds { get; set; }
    public string? OtherAnswer { get; set; }
    public string? FileUrl { get; set; }
    public Dictionary<string, string>? MatrixAnswers { get; set; }
    public List<int>? RankingAnswers { get; set; }
}
