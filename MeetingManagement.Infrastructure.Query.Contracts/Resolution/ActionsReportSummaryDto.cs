using System.Collections.Generic;

namespace MeetingManagement.Infrastructure.Query.Contracts.Resolution;

/// <summary>
/// خلاصه گزارش اقدامات
/// </summary>
public class ActionsReportSummaryDto
{
    public int TotalResolutions { get; set; }
    public int TotalAssignments { get; set; }
    public int TotalActions { get; set; }
    public int CompletedAssignments { get; set; }
    public int InProgressAssignments { get; set; }
    public int PendingAssignments { get; set; }
}
