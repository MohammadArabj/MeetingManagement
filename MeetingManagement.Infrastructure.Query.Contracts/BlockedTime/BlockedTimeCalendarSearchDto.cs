using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.BlockedTime;

public class BlockedTimeCalendarSearchDto
{
    public string? FromDate { get; set; }
    public string? ToDate { get; set; }
    public Guid UserGuid { get; set; }
}