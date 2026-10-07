using System;
using System.Collections.Generic;

namespace MeetingManagement.Infrastructure.Query.Contracts.Meeting;

public class SuggestedSlotsRequestDto
{
    public string Date { get; set; } = "";
    public List<MeetingMemberConflictDto> Members { get; set; } = new();
    public Guid? RoomGuid { get; set; }
    public Guid? MeetingGuid { get; set; }
    public int SlotDurationMinutes { get; set; } = 60;   // 60 یا 120
}
// ConflictMemberDto همان DTO موجود در MeetingConflictCheckDto است — نیاز به تعریف جدید ندارد

public class SuggestedSlotDto
{
    public string StartTime { get; set; } = "";
    public string EndTime { get; set; } = "";
}