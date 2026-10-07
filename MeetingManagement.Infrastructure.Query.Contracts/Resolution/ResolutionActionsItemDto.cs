using System.Collections.Generic;

namespace MeetingManagement.Infrastructure.Query.Contracts.Resolution;

/// <summary>
/// آیتم مصوبه در گزارش
/// </summary>
public class ResolutionActionsItemDto
{
    public int ResolutionId { get; set; }
    public string ResolutionNumber { get; set; }
    public string ResolutionTitle { get; set; }
    public string ResolutionText { get; set; }
    public string DecisionsMade { get; set; }
    public string Documentation { get; set; }
    public List<AssignmentActionsItemDto> Assignments { get; set; } = new();
    public int TotalAssignments { get; set; }
}
