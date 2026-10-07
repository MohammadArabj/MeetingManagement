// MeetingManagement.Infrastructure.Query.Contracts/BlockedTime/BlockedTimeJsonModel.cs
using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.BlockedTime;

public class BlockedTimeJsonModel
{
    public long Id { get; set; }
    public Guid Guid { get; set; }
    public string Date { get; set; }
    public string StartTime { get; set; }
    public string EndTime { get; set; }
    public string? Description { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
}

