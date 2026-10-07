namespace SurveyManagement.Domain.ResponseAgg;

/// <summary>
/// نگاشت مستقیم و موقت روی جدول Responses قبل از حذف ستون‌های قدیمی —
/// فقط برای اجرای یک‌بارهٔ Migration دادهٔ قدیمی استفاده می‌شود.
/// </summary>
public class LegacyResponseRow
{
    public long Id { get; set; }
    public Guid Guid { get; set; }
    public long SurveyId { get; set; }
    public Guid? RespondentUserGuid { get; set; }
    public bool IsAnonymous { get; set; }
    public int Status { get; set; } // enum عددی قدیمی: InProgress/Completed/Expired
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}