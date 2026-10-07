namespace MeetingManagement.Infrastructure.Query.Contracts.Assignment;

public class OriginalAssignmentCountsDto
{
    public int TotalOriginal { get; set; }
    public int ActionInProgress { get; set; }
    public int ActionDone { get; set; }
    public int ActionNotDone { get; set; }
    public int ActionEnd { get; set; }
    public int FollowingUp { get; set; }
    public int FollowUpEnd { get; set; }
    public int NotFollowedUp { get; set; }
}