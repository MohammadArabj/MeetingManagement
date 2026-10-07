using System;
using Epc.Application.Command;
using MeetingManagement.Common.Extensions;

namespace MeetingManagement.Application.Contracts.NotificationTemplate;

public class EditNotificationTemplateDto:ICommand
{
    public int Id { get; set; }
    public string Title { get; set; }
    public string? Content { get; set; }
    public NotificationChannel Type { get; set; }
}