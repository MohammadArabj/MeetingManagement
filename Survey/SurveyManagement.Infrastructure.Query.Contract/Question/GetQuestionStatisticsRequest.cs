namespace SurveyManagement.Infrastructure.Query.Contract.Question;

/// <summary>
/// Request برای دریافت آمار سوال
/// </summary>
public record GetQuestionStatisticsRequest(Guid QuestionId);
