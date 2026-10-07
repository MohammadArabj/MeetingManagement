// Assignment Referral DTOs
using MeetingManagement.Common.Extensions;
using MeetingManagement.Infrastructure.Query.Contracts.Assignment;

namespace MeetingManagement.Application.Contracts.Assignment;

public class AssignmentListDto
{
    public int Id { get; set; }
    public string MeetingNumber { get; set; }
    public string MeetingDate { get; set; }
    public string MeetingTitle { get; set; }
    public string Number { get; set; }
    public string Title { get; set; }
    public string Category { get; set; }
    public string Resolution { get; set; }
    public string DueDate { get; set; }
    public string Actor { get; set; }
    public string Follower { get; set; }
    public string ActionStatus { get; set; }
    public string FollowStatus { get; set; }
    public ActionStatus Status { get; set; }
    public ActionFollowStatus FollowStatusId { get; set; }
    public bool IsFollower { get; set; }
    public bool IsBoardMeeting { get; set; }

    // Referral properties
    public bool IsReferral { get; set; }
    public string ReferrerName { get; set; }
    public string ReferralDate { get; set; }
    public int? ParentAssignmentId { get; set; }
    public int ReferralsCount { get; set; }
    public bool CanRefer { get; set; }
    public bool IsActor { get; set; }

    // فیلدهای جدید برای تفکیک بهتر
    public AssignmentViewType ViewType { get; set; }
    public string DisplayRole { get; set; } // نقش کاربر در این تخصیص
    public bool HasPendingAction { get; set; } // آیا اقدام معلقی دارد؟
    public string StatusDescription { get; set; } // توضیح کامل وضعیت
    public string ActionResult { get; set; }
    public string ResultName { get; set; }
    public string ResultDate { get; set; }
    public string ResultDescription { get; set; }
}