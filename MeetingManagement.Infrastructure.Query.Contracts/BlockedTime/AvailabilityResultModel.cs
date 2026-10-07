using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.BlockedTime;

public class AvailabilityResultModel
{
    public Guid UserGuid { get; set; }
    public bool IsAvailable { get; set; }
    public string? ConflictDescription { get; set; }
    public string? BlockedFrom { get; set; }
    public string? BlockedTo { get; set; }
}