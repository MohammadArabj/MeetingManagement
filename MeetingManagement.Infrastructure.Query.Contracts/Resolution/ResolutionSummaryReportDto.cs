using System.Collections.Generic;

namespace MeetingManagement.Infrastructure.Query.Contracts.Resolution;

public class ResolutionSummaryReportDto
{
    public int TotalMeetings { get; set; }
    public int TotalResolutions { get; set; }
    public List<PositionResolutionSummary> PositionSummaries { get; set; } = [];
}
