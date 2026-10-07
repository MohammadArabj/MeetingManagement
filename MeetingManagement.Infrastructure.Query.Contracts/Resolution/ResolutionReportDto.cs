using System.Collections.Generic;

namespace MeetingManagement.Infrastructure.Query.Contracts.Resolution;

public class ResolutionReportDto
{
    public ResolutionSummaryReportDto Summary { get; set; } = new();
    public List<ResolutionDetailReportDto> Details { get; set; } = new();
}