using Epc.Application.Command;

namespace SurveyManagement.Application.Contract.Response;

/// <summary>
/// ذخیره‌ی خودکار پاسخ‌های نیمه‌کاره (فقط برای کاربر واردشده؛ کاربر از توکن خوانده می‌شود).
/// فقط پاسخ‌های ارسالی به‌روز می‌شوند؛ پاسخ خالی یا IsSkipped یعنی پاک کردن پاسخ همان سوال.
/// </summary>
public record SaveResponseDraftDto : ICommand
{
    public Guid SurveyGuid { get; init; }
    public List<ResponseAnswerDto> Answers { get; init; } = new();
}

/// <summary>حذف پیش‌نویس کاربر جاری و شروع دوباره</summary>
public record DiscardResponseDraftDto(Guid SurveyGuid) : ICommand;

public class ResponseDraftSavedDto
{
    public int AnsweredCount { get; set; }
    public int TotalQuestions { get; set; }
    public int ProgressPercentage { get; set; }
    public string SavedAt { get; set; } = string.Empty;

    /// <summary>سوال‌هایی که مقدارشان نامعتبر بود و ذخیره نشد</summary>
    public List<Guid> RejectedQuestionGuids { get; set; } = new();
}
