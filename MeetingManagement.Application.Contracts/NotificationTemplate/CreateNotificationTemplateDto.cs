using Epc.Application.Command;
using MeetingManagement.Common.Extensions;

namespace MeetingManagement.Application.Contracts.NotificationTemplate;

public class CreateNotificationTemplateDto:ICommand
{
    public string Title { get; set; }
    public NotificationChannel Channel { get; set; }
    public string Content { get; set; }
    public string? ParametersJson { get; set; }
}