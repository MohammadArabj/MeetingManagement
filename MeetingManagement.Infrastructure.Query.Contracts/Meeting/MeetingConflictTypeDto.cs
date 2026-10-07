using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.Meeting;

public class MeetingConflictTypeDto
{
    public Guid Guid { get; set; }
    public string Type { get; set; }           // "Meeting" | "Leave" | "BlockedTime"
    public string? Description { get; set; }
    public string? StartTime { get; set; }
    public string? EndTime { get; set; }

    // ─── جزئیات جلسه‌ای که تداخل ایجاد کرده ───
    public Guid? ConflictMeetingGuid { get; set; }
    public string? ConflictMeetingTitle { get; set; }
    public string? ConflictMeetingNumber { get; set; }
    public string? ConflictMeetingStartTime { get; set; }
    public string? ConflictMeetingEndTime { get; set; }
    public string? ConflictMeetingCreatorName { get; set; }
    public string? ConflictMeetingCreatedDate { get; set; }
}