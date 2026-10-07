using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.UserBlockedTime
{
    public class BlockedTimeDto
    {
        public Guid Guid { get; set; }
        public string Date { get; set; } = string.Empty;
        public string StartTime { get; set; } = string.Empty;
        public string EndTime { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string CreatedAt { get; set; } = string.Empty;
    }
}