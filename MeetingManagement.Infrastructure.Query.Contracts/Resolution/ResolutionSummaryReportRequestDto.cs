using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.Resolution;

public class ResolutionSummaryReportRequestDto
{
    public string? FromDate { get; set; }
    public string? ToDate { get; set; }
    public Guid? DepartmentGuid { get; set; }
    public Guid? UserGuid { get; set; }
    public Guid? PositionGuid { get; set; }
}