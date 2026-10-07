using Epc.Domain;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.MeetingStatusAgg;
using MeetingManagement.Domain.NotificationEventAgg;
using MeetingManagement.Domain.NotificationTemplateAgg;

namespace MeetingManagement.Domain.NotificationSettingAgg;

public class NotificationSetting:EntityBase<int>
{
    public int NotificationEventId { get; set; }
    public NotificationEvent Event { get; set; } = null!;
    public int NotificationTemplateId { get; set; }
    public NotificationTemplate Template { get; set; } = null!;
    public bool IsSmsEnabled { get; set; } = true;
    public bool IsNotificationEnabled { get; set; }
    public bool SendToAllParticipants { get; set; } = true; // مثلاً همه اعضای جلسه
}