namespace SurveyManagement.Infrastructure.Query.Contract.Survey;

/// <summary>
/// Request برای دریافت تاریخچه تغییرات
/// </summary>
public record GetSurveyChangeLogsRequest(Guid SurveyId);
