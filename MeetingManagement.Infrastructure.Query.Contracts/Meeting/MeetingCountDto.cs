namespace MeetingManagement.Infrastructure.Query.Contracts.Meeting;

public class MeetingCountDto
{
    public int DraftMeetingsCount { get; set; }
    public int TodayMeetingsCount { get; set; }
    public int UpcomingMeetingsCount { get; set; }
    public int SignatureMeetingsCount { get; set; }
    public int FinishedMeetingsCount { get; set; }
    public int CanceledMeetingsCount { get; set; }
    public int AllMeetingsCount { get; set; }
    public int AttendanceMeetingsCount { get; set; }
    public int UndeterminedMeetingsCount { get; set; } 
}