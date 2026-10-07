namespace SurveyManagement.Domain.Shared.Access;

/// <summary>
/// کلید پیش‌نویس پاسخ هر کاربر در هر نظرسنجی: Guid مشتق‌شده با HMAC از کلید محرمانه‌ی سرور.
/// پیش‌نویس فقط توسط خود سرور قابل یافتن است و در دیتابیس هیچ ستونی به کاربر اشاره نمی‌کند.
/// </summary>
public interface IResponseDraftKeys
{
    Guid For(long surveyId, Guid userGuid);
}
