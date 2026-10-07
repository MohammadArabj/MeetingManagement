namespace SurveyManagement.Infrastructure.Query.Contract.SurveyAccess;

/// <summary>
/// Request برای دریافت پیش‌نویس کاربر
/// </summary>
public record GetUserDraftRequest(Guid SurveyId, Guid UserGuid);
