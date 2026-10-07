using Epc.Domain;
using MeetingManagement.Domain.NotificationEventAgg;

namespace MeetingManagement.Domain.NotificationLogAgg;

public class NotificationLog:EntityBase<long>
{
    public string Receiver { get; set; } = null!;
    public string Message { get; set; } = null!;
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
    public string Status { get; set; } = "pending"; // success, failed, pending
    public string? ErrorMessage { get; set; }

    public int NotificationEventId { get; set; }
    public NotificationEvent Event { get; set; } = null!;
}