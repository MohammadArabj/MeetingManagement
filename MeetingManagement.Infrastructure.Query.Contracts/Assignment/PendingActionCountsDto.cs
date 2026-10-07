using System.Collections.Generic;

namespace MeetingManagement.Infrastructure.Query.Contracts.Assignment;

public class PendingActionCountsDto
{
    public int Total { get; set; }
    public int InProgress { get; set; }
    public int NotDone { get; set; }
    public int Overdue { get; set; }
    public Dictionary<string, int> ByActor { get; set; }
}