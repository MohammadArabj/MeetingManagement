namespace SurveyManagement.Infrastructure.Query.Contract.Response;

public class UserResponseStatusDto
{
    public bool HasParticipated { get; set; }

    /// <summary>پاسخ نیمه‌کاره‌ی ذخیره‌شده دارد</summary>
    public bool HasDraft { get; set; }

    public int DraftProgressPercentage { get; set; }

    /// <summary>می‌تواند (دوباره) پاسخ دهد: شرکت نکرده یا نظرسنجی چند بار پاسخ را می‌پذیرد</summary>
    public bool CanRespond { get; set; }
}
