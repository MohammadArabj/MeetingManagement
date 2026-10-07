using System.Globalization;
using Epc.Application;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.ResolutionAgg;
using Action = MeetingManagement.Domain.ActionAgg.Action;

namespace MeetingManagement.Domain.AssignmentAgg;

/// <summary>
/// تخصیص مصوبه به یک اقدام‌کننده.
/// ─────────────────────────────────────────────────────────────────────────
/// ارجاع (Referral): اقدام‌کننده‌ی یک تخصیص می‌تواند آن را به شخص دیگری ارجاع دهد.
/// ارجاع یک Assignment فرزند است (ParentAssignmentId). قوانین در همین کلاس متمرکز است:
///   • فقط اقدام‌کننده‌ی فعلی می‌تواند ارجاع دهد (کنترل در Handler با سمت عامل)
///   • ارجاع به خود، یا به هر کسی که در زنجیره بالاتر است ممنوع است (جلوگیری از چرخه)
///   • ارجاع تکراری فعال به یک نفر ممنوع است
///   • عمق زنجیره محدود است (تنظیمات ReferralMaxDepth)
///   • سررسید ارجاع ≥ امروز و (به‌طور پیش‌فرض) ≤ سررسید والد
///   • با ثبت نتیجه روی تخصیص اصلی، همه‌ی ارجاع‌های باز زیرمجموعه بسته می‌شوند
///   • ارجاع‌گیرنده با «بازگشت ارجاع» کار را با شرح نتیجه به ارجاع‌دهنده برمی‌گرداند
///   • ارجاع‌دهنده تا وقتی اقدامی ثبت نشده می‌تواند ارجاع را «فراخوانی» کند
/// همه‌ی این‌ها بدون افزودن ستون جدید و با ستون‌های موجود (ActionStatus/Result/ResultDescription) پیاده شده است.
/// </summary>
public class Assignment
{
    public const string ClosedByParentNote = "[بسته شده با ثبت نتیجه تخصیص اصلی]";
    public const string RecalledNote = "[فراخوانی شد توسط ارجاع‌دهنده]";
    public const string ReturnedNote = "[بازگشت ارجاع]";

    public Assignment()
    {
    }

    public Assignment(Guid? actorGuid, Guid? followerGuid, Guid? actorPositionGuid, Guid? followerPositionGuid,
        AssignmentType type, string dueDate, long resolutionId, ActionStatus? status = null, int? parentAssignmentId = null,
        Guid? referrerGuid = null, Guid? referrerPositionGuid = null, Guid? creator = null)
    {
        ActorGuid = actorGuid;
        FollowerGuid = followerGuid;
        ActorPositionGuid = NullIfEmpty(actorPositionGuid);
        FollowerPositionGuid = NullIfEmpty(followerPositionGuid);
        Type = type;
        DueDate = string.IsNullOrWhiteSpace(dueDate) ? null : dueDate.ToGeorgianDateTime();
        ResolutionId = resolutionId;
        ParentAssignmentId = parentAssignmentId;
        ReferrerGuid = referrerGuid;
        FollowStatus = ActionFollowStatus.Pending;
        ActionStatus = status ?? Common.Extensions.ActionStatus.Pending;
        IsReferral = parentAssignmentId.HasValue;
        ReferralDate = IsReferral ? DateTime.Now : null;
        ReferrerPositionGuid = NullIfEmpty(referrerPositionGuid);
        Created = DateTime.Now;
        CreatedBy = creator ?? referrerGuid;
        IsActive = 1;
    }

    // ═══════════════════════════════════════════════════════════
    // نتیجه و وضعیت
    // ═══════════════════════════════════════════════════════════
    public bool IsEnded => ActionStatus == Common.Extensions.ActionStatus.End;

    public void CreateActionResult(AssignmentResult result, string date, string? description)
    {
        Result = result;
        ResultDate = date.ToDateTimeNull() ?? DateTime.Now;
        ResultDescription = description;
        ActionStatus = Common.Extensions.ActionStatus.End;
    }

    public void ChangeFollowStatus(ActionFollowStatus followStatus) => FollowStatus = followStatus;

    public void ChangeStatus(ActionStatus actionStatus) => ActionStatus = actionStatus;

    public void Edit(Guid? actorGuid, Guid? followerGuid, Guid? actorPositionGuid, Guid? followerPositionGuid,
        AssignmentType type, string dueDate, long resolutionId)
    {
        ActorGuid = actorGuid;
        FollowerGuid = followerGuid;
        ActorPositionGuid = NullIfEmpty(actorPositionGuid);
        FollowerPositionGuid = NullIfEmpty(followerPositionGuid);
        Type = type;
        if (!string.IsNullOrWhiteSpace(dueDate))
            DueDate = dueDate.ToGeorgianDateTime();
        ResolutionId = resolutionId;
    }

    /// <summary>آیا این تخصیص قابل حذف است؟ (اقدام یا ارجاع ثبت‌شده ندارد)</summary>
    public bool CanBeDeleted(out string? reason)
    {
        if (Actions.Count > 0)
        {
            reason = "برای این تخصیص اقدام ثبت شده است و قابل حذف نیست.";
            return false;
        }
        if (ReferredAssignments.Count > 0)
        {
            reason = "این تخصیص ارجاع داده شده است و قابل حذف نیست.";
            return false;
        }
        if (IsEnded && Result.HasValue)
        {
            reason = "برای این تخصیص نتیجه ثبت شده است و قابل حذف نیست.";
            return false;
        }
        reason = null;
        return true;
    }

    // ═══════════════════════════════════════════════════════════
    // ارجاع
    // ═══════════════════════════════════════════════════════════

    /// <summary>
    /// ساخت ارجاع جدید. <paramref name="chain"/> = این تخصیص و همه‌ی اجداد آن (برای جلوگیری از چرخه و محاسبه عمق).
    /// </summary>
    public Assignment CreateReferral(
        Guid actorGuid,
        Guid? actorPositionGuid,
        Guid referrerGuid,
        Guid? referrerPositionGuid,
        string? referralNote,
        string? newDueDate,
        IReadOnlyCollection<Assignment> chain,
        int maxDepth,
        bool allowLaterDueDate)
    {
        if (IsEnded)
            throw new InvalidOperationException("برای تخصیص پایان‌یافته امکان ارجاع وجود ندارد.");

        actorPositionGuid = NullIfEmpty(actorPositionGuid);

        if (SamePerson(actorGuid, actorPositionGuid, ActorGuid, ActorPositionGuid))
            throw new InvalidOperationException("ارجاع به خودِ اقدام‌کننده امکان‌پذیر نیست.");

        if (chain.Any(a => SamePerson(actorGuid, actorPositionGuid, a.ActorGuid, a.ActorPositionGuid)
                           || SamePerson(actorGuid, actorPositionGuid, a.ReferrerGuid, a.ReferrerPositionGuid)))
            throw new InvalidOperationException("این شخص در زنجیره‌ی ارجاع‌های بالاتر حضور دارد؛ ارجاع چرخشی مجاز نیست.");

        if (ReferredAssignments.Any(r => !r.IsEnded && SamePerson(actorGuid, actorPositionGuid, r.ActorGuid, r.ActorPositionGuid)))
            throw new InvalidOperationException("این تخصیص قبلاً به همین شخص ارجاع شده و ارجاع هنوز باز است.");

        var depth = chain.Count(a => a.IsReferral) + 1;
        if (depth > maxDepth)
            throw new InvalidOperationException($"حداکثر عمق مجاز ارجاع ({maxDepth} سطح) رعایت نشده است.");

        DateTime? due = string.IsNullOrWhiteSpace(newDueDate) ? DueDate : newDueDate.ToGeorgianDateTime();
        if (due is null)
            throw new InvalidOperationException("مهلت انجام ارجاع مشخص نشده است.");
        if (due.Value.Date < DateTime.Today)
            throw new InvalidOperationException("مهلت ارجاع نمی‌تواند در گذشته باشد.");
        if (!allowLaterDueDate && DueDate is not null && due.Value.Date > DueDate.Value.Date)
            throw new InvalidOperationException("مهلت ارجاع نمی‌تواند دیرتر از مهلت تخصیص اصلی باشد.");

        var referral = new Assignment(
            actorGuid: actorGuid,
            followerGuid: ActorGuid,                 // پیگیری‌کننده‌ی ارجاع = ارجاع‌دهنده (اقدام‌کننده فعلی)
            actorPositionGuid: actorPositionGuid,
            followerPositionGuid: ActorPositionGuid,
            type: Type,
            dueDate: ToShamsi(due.Value),
            resolutionId: ResolutionId,
            parentAssignmentId: Id,
            referrerGuid: referrerGuid,
            referrerPositionGuid: referrerPositionGuid,
            creator: referrerGuid)
        {
            ReferralNote = referralNote
        };

        // اولین ارجاع یعنی کار روی تخصیص والد شروع شده است
        if (ActionStatus == Common.Extensions.ActionStatus.Pending)
            ActionStatus = Common.Extensions.ActionStatus.InProgress;

        ReferredAssignments.Add(referral);
        return referral;
    }

    /// <summary>بازگشت ارجاع توسط ارجاع‌گیرنده؛ شرح آن به‌صورت یک اقدام روی والد ثبت می‌شود.</summary>
    public Action ReturnReferral(Guid actorUserGuid, string description, AssignmentResult? result)
    {
        if (!IsReferral || ParentAssignmentId is null)
            throw new InvalidOperationException("فقط ارجاع‌ها قابل بازگشت هستند.");
        if (IsEnded)
            throw new InvalidOperationException("این ارجاع قبلاً بسته شده است.");
        if (string.IsNullOrWhiteSpace(description))
            throw new InvalidOperationException("شرح بازگشت ارجاع الزامی است.");

        Result = result;
        ResultDate = DateTime.Now;
        ResultDescription = $"{ReturnedNote} {description}".Trim();
        ActionStatus = Common.Extensions.ActionStatus.End;
        if (FollowStatus != ActionFollowStatus.End)
            FollowStatus = ActionFollowStatus.End;

        return new Action(actorUserGuid, ParentAssignmentId.Value, $"{ReturnedNote} {description}".Trim(),
            ToShamsi(DateTime.Now), actorUserGuid, ActionType.Action);
    }

    /// <summary>آیا ارجاع‌دهنده می‌تواند این ارجاع را حذف کند (هنوز کاری روی آن انجام نشده)؟</summary>
    public bool CanBeRecalledByDelete => IsReferral && Actions.Count == 0 && ReferredAssignments.Count == 0 && !IsEnded;

    /// <summary>فراخوانی ارجاعی که روی آن کار انجام شده: بسته می‌شود ولی سابقه‌اش حفظ می‌شود.</summary>
    public void MarkRecalled(string? reason)
    {
        if (!IsReferral) throw new InvalidOperationException("فقط ارجاع‌ها قابل فراخوانی هستند.");
        if (IsEnded) throw new InvalidOperationException("این ارجاع قبلاً بسته شده است.");
        ActionStatus = Common.Extensions.ActionStatus.End;
        FollowStatus = ActionFollowStatus.End;
        ResultDate = DateTime.Now;
        ResultDescription = $"{RecalledNote} {reason}".Trim();
    }

    /// <summary>بستن خودکار ارجاع باز به‌دلیل پایان تخصیص والد.</summary>
    public void CloseByParent()
    {
        if (IsEnded) return;
        ActionStatus = Common.Extensions.ActionStatus.End;
        FollowStatus = ActionFollowStatus.End;
        ResultDate = DateTime.Now;
        ResultDescription = ClosedByParentNote;
    }

    public void UpdateReferralNote(string note) => ReferralNote = note;

    // ═══════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════
    public static bool SamePerson(Guid? userA, Guid? positionA, Guid? userB, Guid? positionB)
    {
        if (positionA is not null && positionB is not null)
            return positionA == positionB && (userA is null || userB is null || userA == userB);
        return userA is not null && userA == userB;
    }

    private static Guid? NullIfEmpty(Guid? g) => g == Guid.Empty ? null : g;

    public static string ToShamsi(DateTime date)
    {
        var pc = new PersianCalendar();
        return $"{pc.GetYear(date):0000}/{pc.GetMonth(date):00}/{pc.GetDayOfMonth(date):00}";
    }

    // ═══════════════════════════════════════════════════════════
    // Properties (بدون تغییر نسبت به اسکیمای فعلی)
    // ═══════════════════════════════════════════════════════════
    public int Id { get; set; }
    public Guid? ActorGuid { get; private set; }
    public Guid? ActorPositionGuid { get; private set; }
    public Guid? FollowerGuid { get; private set; }
    public Guid? FollowerPositionGuid { get; private set; }
    public AssignmentType Type { get; private set; }
    public DateTime? DueDate { get; private set; }
    public DateTime? ResultDate { get; private set; }
    public ActionFollowStatus? FollowStatus { get; private set; }
    public ActionStatus? ActionStatus { get; set; }
    public AssignmentResult? Result { get; set; }
    public string? ResultDescription { get; set; }
    public DateTime? Created { get; private set; }
    public Guid? CreatedBy { get; private set; }
    public int? IsActive { get; set; }
    public long ResolutionId { get; private set; }

    // Referral
    public int? ParentAssignmentId { get; private set; }
    public Guid? ReferrerGuid { get; private set; }
    public Guid? ReferrerPositionGuid { get; private set; }
    public bool IsReferral { get; private set; }
    public DateTime? ReferralDate { get; private set; }
    public string? ReferralNote { get; private set; }

    // Navigation
    public Resolution Resolution { get; set; }
    public List<Action> Actions { get; set; } = [];
    public Assignment ParentAssignment { get; set; }
    public List<Assignment> ReferredAssignments { get; set; } = [];
}
