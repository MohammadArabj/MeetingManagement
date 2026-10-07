using MeetingManagement.Common.Extensions;

namespace MeetingManagement.Infrastructure.Query.Contracts.NotificationTemplate;

public class NotificationTemplateDto
{
    public int Id { get; set; }
    public string Title { get; set; }
    public NotificationChannel Channel { get; set; }
    public string Content { get; set; }
}