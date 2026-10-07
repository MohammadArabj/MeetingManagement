namespace SurveyManagement.Infrastructure.Query.Contract.Question;

/// <summary>
/// Request برای دریافت سوالات با جزئیات (برای پاسخ‌دهی)
/// </summary>
public record GetQuestionsForResponseRequest(Guid SurveyId, bool IncludeLogic);
