using System;
using Epc.Application.Command;
using MeetingManagement.Common.Extensions;

namespace MeetingManagement.Application.Contracts.Assignment;

public class AssignmentDto : ICommand
{
    public int? Id { get; set; }
    public Guid? ActorGuid { get; set; }
    public Guid? FollowerGuid { get; set; }
    public Guid? ActorPositionGuid { get; set; }
    public Guid? FollowerPositionGuid { get; set; }
    public AssignmentType Type { get; set; }
    public string DueDate { get; set; }
    //public string FollowUpDate { get; set; }
    public Guid? MeetingGuid { get; set; }
    public long ResolutionId { get; set; }
    public string? TypeName { get; set; }
    public int? ParentAssignmentId { get; set; }
    public Guid? ReferrerGuid { get; set; }
    public bool IsReferral { get; set; }
    public string ReferralNote { get; set; }
    public string MeetingNumber { get; set; }
    public string MeetingDate { get; set; }
    public string MeetingTitle { get; set; }
    public string Number { get; set; }
    public string Title { get; set; }
    public string DecisionsMade { get; set; }
    public string Category { get; set; }
    public string Resolution { get; set; }
    public string Actor { get; set; }
    public string Follower { get; set; }
    public string ActionStatus { get; set; }
    public string FollowStatus { get; set; }
    public ActionStatus Status { get; set; }
    public ActionFollowStatus FollowStatusId { get; set; }
    public bool IsFollower { get; set; }
    public bool IsBoardMeeting { get; set; }

    // Referral properties
    public string ReferrerName { get; set; }
    public string ReferralDate { get; set; }
    public int ReferralsCount { get; set; }
    public bool CanRefer { get; set; } // آیا کاربر می‌تواند ارجاع دهد؟
    public bool IsActor { get; set; }
    public string ActionResult { get; set; }
    public string ResultName { get; set; }
    public string ResultDate { get; set; }
    public string ResultDescription { get; set; }
}