namespace MeetingManagement.Infrastructure.Query.Contracts.Assignment;

public class ReferralCountsDto
{
    public int Total { get; set; }
    public int Pending { get; set; }
    public int InProgress { get; set; }
    public int Completed { get; set; }
    public int Overdue { get; set; }
}