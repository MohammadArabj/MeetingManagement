namespace SurveyManagement.Infrastructure.Query.Contract.Response;

/// <summary>
/// Request برای دریافت خلاصه پاسخ‌ها
/// </summary>
public record GetResponseSummaryRequest(Guid SurveyId);
