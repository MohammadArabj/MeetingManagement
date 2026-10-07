using System;
using System.Collections.Generic;

namespace MeetingManagement.Infrastructure.Query.Contracts.Meeting;

public class MeetingConflictCheckDto
{
    public string Date { get; set; }
    public TimeSpan StartTime { get; set; }
    public TimeSpan EndTime { get; set; }
    public List<MeetingMemberConflictDto> Members { get; set; } = [];
    public Guid? RoomGuid { get; set; }
    public Guid? MeetingGuid { get; set; }
}

public class MeetingMemberConflictDto
{
    public Guid UserGuid { get; set; }
    public string UserName  { get; set; }
    public int RoleId { get; set; }
}