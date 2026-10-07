// Assignment Referral DTOs

using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.Assignment;

public class AssignmentReferralListDto
{
    public int Id { get; set; }
    public Guid? ActorGuid { get; set; }
    public Guid? ActorPositionGuid { get; set; }
    public string ActorName { get; set; }
    public string ActorPositionTitle { get; set; }
    public string ReferrerName { get; set; }
    public string ReferralDate { get; set; }
    public string ReferralNote { get; set; }
    public string DueDate { get; set; }
    public string ActionStatus { get; set; }
    public string FollowStatus { get; set; }
    public int ActionStatusId { get; set; }
    public int FollowStatusId { get; set; }
    public bool CanPerformAction { get; set; }
    public int ActionsCount { get; set; }
    public int FollowupsCount { get; set; }
}
