// Assignment Referral DTOs
using MeetingManagement.Infrastructure.Query.Contracts.Action;
using System.Collections.Generic;

namespace MeetingManagement.Application.Contracts.Assignment;

public class AssignmentTreeDto
{
    public int Id { get; set; }
    public string ActorName { get; set; }
    public string PersonalNo { get; set; }
    public string ActorPositionTitle { get; set; }
    public string ReferrerName { get; set; }
    public string ReferralDate { get; set; }
    public string ReferralNote { get; set; }
    public string AssignmentDate { get; set; }
    public string ActionStatus { get; set; }
    public string FollowStatus { get; set; }
    public bool IsReferral { get; set; }
    public int Level { get; set; }
    public List<AssignmentTreeDto> Children { get; set; } = [];
    public List<ActionListDto> Actions { get; set; } = [];
    public List<ActionListDto> Followups { get; set; } = [];
    public string ActorPersonalNo { get; set; }
}
