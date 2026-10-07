using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.UserBlockedTime
{
    public class AvailabilityResultDto
    {
        public Guid PositionGuid { get; set; }
        public bool IsAvailable { get; set; }
        public string? ConflictDescription { get; set; }
        public string? BlockedFrom { get; set; }
        public string? BlockedTo { get; set; }
    }
}