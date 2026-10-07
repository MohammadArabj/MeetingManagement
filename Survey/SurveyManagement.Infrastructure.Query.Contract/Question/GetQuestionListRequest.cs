namespace SurveyManagement.Infrastructure.Query.Contract.Question;

/// <summary>
/// Request برای دریافت لیست سوالات
/// </summary>
public record GetQuestionListRequest(Guid SurveyId);
