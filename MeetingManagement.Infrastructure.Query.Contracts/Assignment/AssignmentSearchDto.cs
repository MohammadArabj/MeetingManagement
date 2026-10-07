using System;
using MeetingManagement.Common.Extensions;

namespace MeetingManagement.Infrastructure.Query.Contracts.Assignment;

public class AssignmentSearchDto
{
    public Guid UserGuid { get; set; }
    public Guid PositionGuid { get; set; }

    // نوع نمایش
    public AssignmentViewType? ViewType { get; set; }

    // نقش کاربر
    public ActionType? Type { get; set; } // Action or Follow

    // فیلترهای وضعیت
    public ActionStatus? ActionStatus { get; set; }
    public ActionFollowStatus? ApprovalStatus { get; set; } // همان FollowStatus

    // فیلتر نتیجه (فقط برای پایان یافته‌ها)
    public AssignmentResult? Result { get; set; }

    // فیلتر گذشته از مهلت
    public bool OverdueOnly { get; set; }

    // فیلترهای قدیمی (deprecated اما نگه داشتیم برای backward compatibility)
    public ActionStatus? PendingActionStatus { get; set; }
}

public enum AssignmentViewType
{
    All,
    OriginalAssignment,      // تخصیص‌های اصلی
    ReceivedReferral,        // ارجاعات دریافتی
    GivenReferral           // ارجاعات ارسالی
}

