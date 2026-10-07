using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.Resolution;

/// <summary>
/// درخواست گزارش اقدامات مصوبات
/// </summary>
public class GetActionsReportQuery
{
    public Guid MeetingGuid { get; set; }
    public int? ResolutionId { get; set; }
    public int? AssignmentId { get; set; }
}
