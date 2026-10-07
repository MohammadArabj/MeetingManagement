using MeetingManagement.Common.Extensions;
using System.Collections.Generic;

namespace MeetingManagement.Infrastructure.Query.Contracts.Resolution;

/// <summary>
/// گزارش کلی اقدامات جلسه
/// </summary>
public class MeetingActionsReportDto
{
    public string MeetingGuid { get; set; }
    public string MeetingNumber { get; set; }
    public string MeetingTitle { get; set; }
    public string MeetingDate { get; set; }
    public string MeetingCategory { get; set; }
    public bool IsBoardMeeting { get; set; }
    public List<ResolutionActionsItemDto> Resolutions { get; set; } = new();
    public ActionsReportSummaryDto Summary { get; set; }
}
