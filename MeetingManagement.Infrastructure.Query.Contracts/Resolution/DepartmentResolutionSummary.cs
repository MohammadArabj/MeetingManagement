using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.Resolution;

public class DepartmentResolutionSummary
{
    public string DepartmentName { get; set; }
    public Guid DepartmentGuid { get; set; }
    public int TotalResolutions { get; set; }
    public int CompletedResolutions { get; set; }
    public int InProgressResolutions { get; set; }
    public int NotStartedResolutions { get; set; }
    public int OverdueResolutions { get; set; }
    public double CompletionPercentage { get; set; }
    public int TotalMeetings { get; set; }
}