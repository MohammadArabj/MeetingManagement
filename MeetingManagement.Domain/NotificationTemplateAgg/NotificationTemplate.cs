using Epc.Domain;
using MeetingManagement.Domain.NotificationEventAgg;
using MeetingManagement.Domain.NotificationSettingAgg;

namespace MeetingManagement.Domain.NotificationTemplateAgg;

public class NotificationTemplate:EntityBase<int>
{
    public string Title { get; set; } = null!;
    public string Content { get; set; } = null!;
    public int NotificationEventId { get; set; }
    public NotificationEvent Event { get; set; } = null!;
    public ICollection<NotificationSetting> Settings { get; set; } = new List<NotificationSetting>();
}