using System;
using MeetingManagement.Common.Extensions;

namespace MeetingManagement.Infrastructure.Query.Contracts.Resolution;
public class ResolutionDetailReportDto
{
    public string MeetingNumber { get; set; }
    public string MeetingCategory { get; set; }
    public string MeetingTitle { get; set; }
    public string MeetingDate { get; set; }
    public string ResolutionNumber { get; set; }
    public string ResolutionTitle { get; set; }
    public string DecisionsMade { get; set; }
    public string Position { get; set; }
    public string ActorName { get; set; }
    public string DueDate { get; set; }
    public ActionStatus? ActionStatus { get; set; }
    public AssignmentResult? Result { get; set; } // تغییر از string به AssignmentResult?
    public string Description { get; set; }
    public int TotalActions { get; set; }
    public string ResolutionText { get; set; }
}