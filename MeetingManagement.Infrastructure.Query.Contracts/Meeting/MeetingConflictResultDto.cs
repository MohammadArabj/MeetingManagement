using System;
using System.Collections.Generic;

namespace MeetingManagement.Infrastructure.Query.Contracts.Meeting;


public class MeetingConflictResultDto
{
    public bool RoomConflict { get; set; }
    public List<MeetingConflictTypeDto> UsersWithConflict { get; set; } = new();

    // ─── جزئیات جلسه‌ای که مکان را اشغال کرده ───
    public RoomConflictMeetingDto? RoomConflictMeeting { get; set; }
}

public class RoomConflictMeetingDto
{
    public Guid Guid { get; set; }
    public string Title { get; set; } = "";
    public string? Number { get; set; }
    public string StartTime { get; set; } = "";
    public string EndTime { get; set; } = "";
    public string? CreatorName { get; set; }
    public string? CreatedDate { get; set; }
}

