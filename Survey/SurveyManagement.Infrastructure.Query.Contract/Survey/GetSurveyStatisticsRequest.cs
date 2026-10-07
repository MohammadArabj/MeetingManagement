namespace SurveyManagement.Infrastructure.Query.Contract.Survey;

/// <summary>
/// Request برای دریافت آمار نظرسنجی
/// </summary>
public record GetSurveyStatisticsRequest(Guid SurveyId);
