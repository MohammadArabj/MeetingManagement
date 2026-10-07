namespace MeetingManagement.Infrastructure.Query.Contracts.Assignment;

public class FollowerActorsActionCountsDto
{
    public int Total { get; set; }
    public int Pending { get; set; }
    public int InProgress { get; set; }
    public int End { get; set; }
    public int Overdue { get; set; }
}
