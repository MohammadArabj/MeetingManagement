using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.Meeting;

public class MeetingDetailsModel
{
    public Guid? Guid { get; set; }
    public required string Title { get; set; }
    public required string Date { get; set; }
    public TimeSpan StartTime { get; set; }
    public TimeSpan EndTime { get; set; }
    public string? RoomName { get; set; }
    public string? RoomLink { get; set; }
    public Guid? RoomGuid { get; set; }
    public Guid CategoryGuid { get; set; }
    public Guid? FollowGuid { get; set; }
}