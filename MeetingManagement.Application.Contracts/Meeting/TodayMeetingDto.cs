using System;

namespace MeetingManagement.Application.Contracts.Meeting;

public class TodayMeetingDto
{
    public string Title { get; set; }
    public string Number { get; set; }
    public string Room { get; set; }
    public string Time { get; set; }
    public string Type { get; set; }
    public Guid Guid { get; set; }
}