using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.Meeting;

public class MeetingCalendarDto
{
    public string Title { get; set; }
    public DateTime Start { get; set; }
    public DateTime End { get; set; }
    public string Type { get; set; }
    public Guid Guid { get; set; }
}