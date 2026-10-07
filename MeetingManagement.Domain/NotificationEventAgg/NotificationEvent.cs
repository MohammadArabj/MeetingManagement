using Epc.Domain;
using MeetingManagement.Domain.NotificationLogAgg;
using MeetingManagement.Domain.NotificationSettingAgg;
using MeetingManagement.Domain.NotificationTemplateAgg;

namespace MeetingManagement.Domain.NotificationEventAgg;

public class NotificationEvent:EntityBase<int>
{
    public string Title { get; set; } = null!; // "ثبت جلسه" یا "یادآوری جلسه فردا"
    public string? Description { get; set; }
    public bool IsScheduled { get; set; } = false; // ایونت زمان‌بندی‌شده؟
    public TimeSpan? ScheduledTime { get; set; } // ساعت اجرای Job (در صورت زمان‌بندی‌شده بودن)
    public byte? Interval { get; set; }
    public ICollection<NotificationTemplate> Templates { get; set; } = new List<NotificationTemplate>();
    public ICollection<NotificationSetting> Settings { get; set; } = new List<NotificationSetting>();
    public ICollection<NotificationLog> Logs { get; set; } = new List<NotificationLog>();
}