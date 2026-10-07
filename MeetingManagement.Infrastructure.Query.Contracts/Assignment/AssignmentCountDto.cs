using MeetingManagement.Common.Extensions;

namespace MeetingManagement.Infrastructure.Query.Contracts.Assignment;

public class AssignmentCountDto
{
    public ActionCounts ActionCounts { get; set; }
    public ActionCounts FollowCounts { get; set; }
}
public class ActionCounts
{
    public int End { get; set; }
    public int InProgress { get; set; }
    public int Pending { get; set; }
    public int Overdue { get; set; }
}

