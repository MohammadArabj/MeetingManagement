namespace MeetingManagement.Infrastructure.Query.Contracts.Meeting;

public class CheckMeetingDto
{
    public bool ExistResolution { get; set; }
    public bool Attendance { get; set; }
}