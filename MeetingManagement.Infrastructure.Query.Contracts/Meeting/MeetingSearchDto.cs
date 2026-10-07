using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.Meeting;

public class MeetingSearchDto
{
    public Guid MeetingGuid { get; set; }
    public Guid UserGuid { get; set; }
    public Guid PositionGuid { get; set; }
    public bool CanView { get; set; }
}