using System;
using Epc.Application.Command;
using MeetingManagement.Common.Extensions;

namespace MeetingManagement.Application.Contracts.NotificationSetting;

public class EditNotificationSettingDto:ICommand
{
    public int StatusId { get; set; }
    public NotificationTriggerType SendType { get; set; }
    public int TemplateId { get; set; }
    public int? ReminderHoursBefore { get; set; }
    public int Id { get; set; }
}