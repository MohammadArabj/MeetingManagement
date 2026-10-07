using MeetingManagement.Common.Extensions;
using System.Collections.Generic;

namespace MeetingManagement.Infrastructure.Query.Contracts.Resolution;

public class AssignmentReportItemDto
{
    public int AssignmentId { get; set; }
    public string ActorName { get; set; }
    public string ActorPosition { get; set; }
    public string FollowerName { get; set; }
    public string Type { get; set; }
    public string DueDate { get; set; }
    public ActionStatus ActionStatus { get; set; }
    public AssignmentResult? Result { get; set; }
    public string LastActionDate { get; set; }
    public int TotalActions { get; set; }
    public List<ActionReportItemDto> Actions { get; set; }
}
