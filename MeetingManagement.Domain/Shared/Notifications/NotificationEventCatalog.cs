using MeetingManagement.Common.Extensions;

namespace MeetingManagement.Domain.Shared.Notifications;

/// <summary>تعریف پیش‌فرض هر رویداد: گیرندگان، زمان‌بندی، و قالب پیش‌فرض.</summary>
public sealed record NotificationEventDefinition(
    NotificationEventCode Code,
    NotificationRecipient DefaultRecipients,
    bool IsScheduled,
    string DefaultTemplate,
    bool SmsByDefault = true,
    bool InAppByDefault = true)
{
    public string Title => Code.GetDescription();
}

/// <summary>
/// کاتالوگ رویدادها. جدول NotificationEvents از روی همین کاتالوگ seed می‌شود؛
/// افزودن رویداد جدید = افزودن یک خط اینجا + فراخوانی PublishAsync در جای مناسب.
/// </summary>
public static class NotificationEventCatalog
{
    public static readonly IReadOnlyList<NotificationEventDefinition> All =
    [
        new(NotificationEventCode.MeetingCreated, NotificationRecipient.AllMembers, false,
            "{ReceiverName} گرامی، جلسه «{MeetingTitle}» در تاریخ {MeetingDate} ساعت {StartTime} در {Location} برگزار می‌شود. {Link}"),
        new(NotificationEventCode.MeetingRescheduled, NotificationRecipient.AllMembers, false,
            "{ReceiverName} گرامی، زمان/مکان جلسه «{MeetingTitle}» تغییر کرد: {MeetingDate} ساعت {StartTime} - {Location}"),
        new(NotificationEventCode.MeetingCanceled, NotificationRecipient.AllMembers, false,
            "{ReceiverName} گرامی، جلسه «{MeetingTitle}» مورخ {MeetingDate} لغو شد."),
        new(NotificationEventCode.MeetingReminder, NotificationRecipient.AllMembers, true,
            "یادآوری: جلسه «{MeetingTitle}» {MeetingDate} ساعت {StartTime} در {Location}"),
        new(NotificationEventCode.AttendanceRequested, NotificationRecipient.AllMembers, false,
            "{ReceiverName} گرامی، لطفاً حضور خود در جلسه «{MeetingTitle}» ({MeetingDate}) را اعلام نمایید. {Link}"),
        // امضای رئیس اول است؛ پس از آن سایر اعضا با رویداد ChairmanSigned مطلع می‌شوند
        new(NotificationEventCode.MinutesReadyForSignature, NotificationRecipient.Chairman, false,
            "{ReceiverName} گرامی، صورتجلسه «{MeetingTitle}» آماده امضای شما است. {Link}"),
        new(NotificationEventCode.MeetingFinalized, NotificationRecipient.Chairman | NotificationRecipient.Secretary, false,
            "جلسه «{MeetingTitle}» شماره {MeetingNumber} نهایی شد.", SmsByDefault: false),
        new(NotificationEventCode.ChairmanSigned, NotificationRecipient.AllMembers, false,
            "{ReceiverName} گرامی، صورتجلسه «{MeetingTitle}» توسط رئیس جلسه امضا شد؛ لطفاً نسبت به امضای آن اقدام فرمایید. {Link}"),
        new(NotificationEventCode.SubstituteAssigned, NotificationRecipient.Substitute, false,
            "{ReceiverName} گرامی، شما به‌عنوان جانشین در جلسه «{MeetingTitle}» ({MeetingDate}) معرفی شدید."),

        new(NotificationEventCode.ResolutionAssigned, NotificationRecipient.Actor, false,
            "{ReceiverName} گرامی، مصوبه {ResolutionNumber} جلسه «{MeetingTitle}» با مهلت {DueDate} به شما تخصیص یافت. {Link}"),
        new(NotificationEventCode.AssignmentReferred, NotificationRecipient.Actor, false,
            "{ReceiverName} گرامی، {ReferrerName} یک تخصیص با مهلت {DueDate} به شما ارجاع داد. {Link}"),
        new(NotificationEventCode.AssignmentDueReminder, NotificationRecipient.Actor, true,
            "یادآوری: مهلت انجام تخصیص مصوبه {ResolutionNumber} جلسه «{MeetingTitle}» {DueDate} است."),
        new(NotificationEventCode.AssignmentOverdue, NotificationRecipient.Actor | NotificationRecipient.Follower, true,
            "مهلت تخصیص مصوبه {ResolutionNumber} جلسه «{MeetingTitle}» ({DueDate}) گذشته است."),
        new(NotificationEventCode.ActionRegistered, NotificationRecipient.Follower, false,
            "برای مصوبه {ResolutionNumber} جلسه «{MeetingTitle}» اقدام جدید ثبت شد.", SmsByDefault: false),
        new(NotificationEventCode.AssignmentCompleted, NotificationRecipient.Follower, false,
            "تخصیص مصوبه {ResolutionNumber} جلسه «{MeetingTitle}» توسط {ActorName} به پایان رسید.", SmsByDefault: false),
        new(NotificationEventCode.ReferralReturned, NotificationRecipient.Referrer, false,
            "{ActorName} ارجاع مصوبه {ResolutionNumber} را بازگرداند.", SmsByDefault: false),
    ];

    public static NotificationEventDefinition Get(NotificationEventCode code) => All.First(x => x.Code == code);

    /// <summary>فهرست placeholder های قابل استفاده در قالب‌ها (برای راهنمای صفحه تنظیمات).</summary>
    public static readonly IReadOnlyDictionary<string, string> Placeholders = new Dictionary<string, string>
    {
        ["ReceiverName"] = "نام گیرنده",
        ["MeetingTitle"] = "عنوان جلسه",
        ["MeetingNumber"] = "شماره جلسه",
        ["MeetingDate"] = "تاریخ جلسه",
        ["StartTime"] = "ساعت شروع",
        ["EndTime"] = "ساعت پایان",
        ["Location"] = "مکان/لینک جلسه",
        ["CategoryTitle"] = "دسته‌بندی جلسه",
        ["ResolutionNumber"] = "شماره مصوبه",
        ["ResolutionTitle"] = "عنوان/متن کوتاه مصوبه",
        ["DueDate"] = "مهلت انجام",
        ["ActorName"] = "نام اقدام‌کننده",
        ["ReferrerName"] = "نام ارجاع‌دهنده",
        ["SystemName"] = "نام سامانه",
        ["Link"] = "لینک مستقیم",
    };
}
