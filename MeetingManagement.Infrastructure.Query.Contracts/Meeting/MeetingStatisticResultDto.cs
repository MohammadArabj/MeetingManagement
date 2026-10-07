namespace MeetingManagement.Infrastructure.Query.Contracts.Meeting;

public class MeetingStatisticResultDto
{
    public string DateLabel { get; set; }
    public int Count { get; set; }
    public double Duration { get; set; }
}