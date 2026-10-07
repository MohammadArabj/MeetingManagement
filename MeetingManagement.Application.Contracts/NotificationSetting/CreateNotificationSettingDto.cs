using Epc.Application.Command;
using MeetingManagement.Common.Extensions;

namespace MeetingManagement.Application.Contracts.NotificationSetting;

public class CreateNotificationSettingDto:ICommand
{
    public int StatusId { get; set; }
    public NotificationTriggerType SendType { get; set; }
    public int TemplateId { get; set; }
    public int? ReminderHoursBefore { get; set; }
}