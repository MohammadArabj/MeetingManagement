using System;
using System.Collections.Generic;

namespace MeetingManagement.Infrastructure.Query.Contracts.Resolution;

public class PositionResolutionSummary
{
    public string PositionName { get; set; }
    public Guid PositionGuid { get; set; }
    public int TotalResolutions { get; set; }
    public int TotalMeetings { get; set; }
    public int CompletedResolutions { get; set; }
    public int InProgressResolutions { get; set; }
    public int NotStartedResolutions { get; set; }
    public int OverdueResolutions { get; set; }
    public double CompletionPercentage { get; set; }
}