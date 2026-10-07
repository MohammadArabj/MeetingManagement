using MeetingManagement.Common.Extensions;

namespace MeetingManagement.Domain.Shared.Access;

/// <summary>
/// نتیجه‌ی محاسبه دسترسی کاربر جاری روی یک جلسه.
/// </summary>
public sealed record MeetingAccess
{
    public static readonly MeetingAccess NotFound = new() { Exists = false };

    public bool Exists { get; init; } = true;
    public long MeetingId { get; init; }
    public Guid MeetingGuid { get; init; }
    public int StatusId { get; init; }
    public MeetingKind Kind { get; init; }

    /// <summary>نقش کاربر در جلسه (null = عضو نیست)</summary>
    public int? RoleId { get; init; }
    public MeetingRoleKey RoleKey { get; init; }
    public string? RoleTitle { get; init; }

    public MeetingCapability Capabilities { get; init; }

    public bool IsSuperAdmin { get; init; }
    public bool IsCreator { get; init; }

    /// <summary>کاربر به‌عنوان جانشین یکی از اعضا وارد شده است</summary>
    public bool IsSubstitute { get; init; }

    /// <summary>کاربر دسترسی سیستمی «مشاهده همه جلسات» دارد ولی عضو نیست</summary>
    public bool IsGlobalViewer { get; init; }

    public bool ChairmanSigned { get; init; }

    public MeetingWorkflow Workflow => MeetingWorkflow.For(Kind);

    public bool Can(MeetingCapability capability) =>
        IsSuperAdmin || (Capabilities & capability) == capability;

    /// <summary>آیا محتوا (مصوبات/دستور جلسه) در وضعیت فعلی قابل ویرایش است؟</summary>
    public bool IsContentEditable =>
        Workflow.ResolutionEditableStatuses.Contains(StatusId)
        && !(Workflow.LockContentAfterChairmanSign && ChairmanSigned);

    /// <summary>
    /// تخصیص‌های جلسه «ابلاغ» شده‌اند؟ جلسات دارای صورتجلسه: پس از امضای رئیس؛ سایر جلسات: پس از اتمام.
    /// پیش از ابلاغ، اقدام‌کننده تخصیص را نمی‌بیند و روی آن کاری انجام نمی‌دهد.
    /// </summary>
    public bool IsPublished => StatusId != MeetingStatusIds.Cancelled
                               && (Workflow.HasMinutes ? ChairmanSigned : StatusId == MeetingStatusIds.Completed);

    public bool CanEditResolutions => Can(MeetingCapability.ManageResolutions) && (IsSuperAdmin || IsContentEditable);
    public bool CanManageAssignments => Can(MeetingCapability.ManageAssignments) && (IsSuperAdmin || IsContentEditable);

    public static string DeniedMessage(MeetingCapability capability) =>
        $"شما مجوز «{capability.GetDescription()}» را در این جلسه ندارید.";

    public const string LockedMessage = "در وضعیت فعلی جلسه امکان ویرایش محتوا وجود ندارد.";
}

/// <summary>
/// محاسبه دسترسی کاربر جاری روی جلسه — تنها منبع حقیقت برای «چه کسی چه کاری می‌تواند بکند».
/// فرانت هم همین خروجی را از API می‌گیرد و دیگر خودش با roleId تصمیم نمی‌گیرد.
/// </summary>
public interface IMeetingAccessService
{
    Task<MeetingAccess> GetAsync(long meetingId, CancellationToken ct = default);
    Task<MeetingAccess> GetAsync(Guid meetingGuid, CancellationToken ct = default);
    Task<MeetingAccess> GetByResolutionAsync(long resolutionId, CancellationToken ct = default);

    /// <summary>دسترسی جلسه‌ای که فایل به آن تعلق دارد (فایل جلسه، مصوبه یا دستور جلسه)</summary>
    Task<MeetingAccess> GetByFileModuleAsync(FileType type, long moduleId, CancellationToken ct = default);
}
