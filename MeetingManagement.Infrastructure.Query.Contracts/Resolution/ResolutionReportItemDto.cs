using System.Collections.Generic;

namespace MeetingManagement.Infrastructure.Query.Contracts.Resolution;

public class ResolutionReportItemDto
{
    public long ResolutionId { get; set; }
    public string ResolutionNumber { get; set; }
    public string ResolutionTitle { get; set; }
    public string ResolutionText { get; set; }
    public string DecisionsMade { get; set; }
    public string Documentation { get; set; }
    public List<AssignmentReportItemDto> Assignments { get; set; }
    public int TotalAssignments { get; set; }
}
