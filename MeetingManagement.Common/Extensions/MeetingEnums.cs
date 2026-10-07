using System;
using System.Collections.Generic;
using System.Linq;
using System.ComponentModel;

namespace MeetingManagement.Common.Extensions;

// ═══════════════════════════════════════════════════════════════════════════
//  نقش‌های جلسه
//  ─────────────────────────────────────────────────────────────────────────
//  قبلاً نقش‌ها با Id (1..6) در کد هاردکد شده بودند. حالا هر نقش یک «کلید
//  سیستمی» (SystemKey) دارد که معنای آن را مشخص می‌کند و یک مجموعه «توانایی»
//  (Capabilities) که مشخص می‌کند دارنده‌ی نقش چه کارهایی می‌تواند انجام دهد.
//  Id ها دیگر هیچ معنایی ندارند و می‌توان نقش جدید تعریف کرد یا توانایی‌ها را
//  از صفحه تنظیمات تغییر داد.
// ═══════════════════════════════════════════════════════════════════════════

/// <summary>
/// کلید معنایی نقش. کد فقط با این کلید کار می‌کند، نه با Id.
/// نقش‌های تعریف‌شده توسط کاربر کلید <see cref="Custom"/> دارند.
/// </summary>
public enum MeetingRoleKey : byte
{
    [Description("سفارشی")] Custom = 0,
    [Description("دبیر")] Secretary = 1,
    [Description("دبیر غیرعضو")] NonMemberSecretary = 2,
    [Description("رئیس")] Chairman = 3,
    [Description("ناظر")] Observer = 4,
    [Description("عضو")] Member = 5,
    [Description("مهمان")] Guest = 6,
}

/// <summary>
/// توانایی‌های قابل تخصیص به یک نقش جلسه.
/// به‌صورت Flags در یک ستون bigint ذخیره می‌شود (بدون جدول واسط و بدون Join).
/// ⚠️ مقدار عددی هیچ عضوی را تغییر ندهید؛ فقط عضو جدید با بیت جدید اضافه کنید.
/// </summary>
[Flags]
public enum MeetingCapability : long
{
    None = 0,

    // ── مشاهده ─────────────────────────────────────────────
    [Description("مشاهده جزئیات جلسه")] ViewMeeting = 1L << 0,
    [Description("مشاهده دستور جلسه")] ViewAgenda = 1L << 1,
    [Description("مشاهده مصوبات")] ViewResolutions = 1L << 2,
    [Description("مشاهده صورتجلسه")] ViewMinutes = 1L << 3,
    [Description("مشاهده فایل‌ها")] ViewFiles = 1L << 4,
    [Description("مشاهده پیگیری‌ها")] ViewFollowUps = 1L << 5,

    // ── مدیریت جلسه ────────────────────────────────────────
    [Description("ویرایش اطلاعات جلسه")] EditMeeting = 1L << 10,
    [Description("مدیریت اعضا")] ManageMembers = 1L << 11,
    [Description("مدیریت دستور جلسه")] ManageAgenda = 1L << 12,
    [Description("ثبت حضور و غیاب")] ManageAttendance = 1L << 13,
    [Description("تغییر وضعیت جلسه")] ChangeStatus = 1L << 14,
    [Description("لغو جلسه")] CancelMeeting = 1L << 15,
    [Description("بارگذاری فایل")] UploadFiles = 1L << 16,

    // ── مصوبات ─────────────────────────────────────────────
    [Description("ثبت/ویرایش مصوبه")] ManageResolutions = 1L << 20,
    [Description("تخصیص مصوبه")] ManageAssignments = 1L << 21,
    [Description("حذف مصوبه")] DeleteResolutions = 1L << 22,

    // ── صورتجلسه و امضا ────────────────────────────────────
    [Description("نگارش صورتجلسه")] WriteMinutes = 1L << 30,
    [Description("امضای صورتجلسه")] SignMinutes = 1L << 31,
    [Description("امضای نهایی (تأیید صورتجلسه)")] FinalApprove = 1L << 32,
    [Description("ثبت نظر روی صورتجلسه")] CommentOnMinutes = 1L << 33,

    // ── سایر ───────────────────────────────────────────────
    [Description("معرفی جانشین")] AppointSubstitute = 1L << 40,
    [Description("چاپ")] Print = 1L << 41,
    [Description("دریافت اطلاع‌رسانی")] ReceiveNotifications = 1L << 42,

    // ── ترکیب‌های پرکاربرد ─────────────────────────────────
    ViewAll = ViewMeeting | ViewAgenda | ViewResolutions | ViewMinutes | ViewFiles | ViewFollowUps,
    ManageAll = EditMeeting | ManageMembers | ManageAgenda | ManageAttendance | ChangeStatus | CancelMeeting
              | UploadFiles | ManageResolutions | ManageAssignments | DeleteResolutions | WriteMinutes,
}

/// <summary>نوع جلسه (جایگزین مقایسه‌ی CategoryGuid با تنظیمات).</summary>
public enum MeetingKind : byte
{
    [Description("جلسه عادی")] Regular = 1,
    [Description("هیئت مدیره")] Board = 2,
    [Description("کمیسیون معاملات")] Committee = 3,
}

// ═══════════════════════════════════════════════════════════════════════════
//  اطلاع‌رسانی
// ═══════════════════════════════════════════════════════════════════════════

/// <summary>
/// کد پایدار رویدادهای اطلاع‌رسانی. جدول NotificationEvents با این کد seed می‌شود
/// و کد برنامه فقط با این کد رویداد را منتشر می‌کند.
/// </summary>
public enum NotificationEventCode : short
{
    // جلسه
    [Description("ثبت جلسه جدید")] MeetingCreated = 1,
    [Description("ویرایش زمان/مکان جلسه")] MeetingRescheduled = 2,
    [Description("لغو جلسه")] MeetingCanceled = 3,
    [Description("یادآوری جلسه")] MeetingReminder = 4,
    [Description("اعلام حضور در جلسه")] AttendanceRequested = 5,
    [Description("آماده‌شدن صورتجلسه برای امضا")] MinutesReadyForSignature = 6,
    [Description("نهایی‌شدن جلسه")] MeetingFinalized = 7,
    [Description("تعیین جانشین")] SubstituteAssigned = 8,

    // مصوبات و پیگیری
    [Description("تخصیص مصوبه")] ResolutionAssigned = 20,
    [Description("ارجاع تخصیص")] AssignmentReferred = 21,
    [Description("یادآوری سررسید تخصیص")] AssignmentDueReminder = 22,
    [Description("تأخیر در انجام تخصیص")] AssignmentOverdue = 23,
    [Description("ثبت اقدام")] ActionRegistered = 24,
    [Description("ثبت نتیجه تخصیص")] AssignmentCompleted = 25,
    [Description("بازگشت ارجاع")] ReferralReturned = 26,
}

/// <summary>گیرندگان یک رویداد (قابل ترکیب).</summary>
[Flags]
public enum NotificationRecipient : int
{
    None = 0,
    [Description("همه اعضای جلسه")] AllMembers = 1 << 0,
    [Description("رئیس جلسه")] Chairman = 1 << 1,
    [Description("دبیر جلسه")] Secretary = 1 << 2,
    [Description("مهمانان")] Guests = 1 << 3,
    [Description("ناظران")] Observers = 1 << 4,
    [Description("ایجادکننده جلسه")] Creator = 1 << 5,
    [Description("اقدام‌کننده")] Actor = 1 << 6,
    [Description("پیگیری‌کننده")] Follower = 1 << 7,
    [Description("ارجاع‌دهنده")] Referrer = 1 << 8,
    [Description("جانشین")] Substitute = 1 << 9,
}

/// <summary>کانال ارسال.</summary>
[Flags]
public enum NotificationChannels : byte
{
    None = 0,
    [Description("پیامک")] Sms = 1 << 0,
    [Description("اعلان داخل سامانه")] InApp = 1 << 1,
    [Description("ایمیل")] Email = 1 << 2,
}

/// <summary>وضعیت پیام در صف ارسال (Outbox).</summary>
public enum NotificationDeliveryStatus : byte
{
    [Description("در صف")] Pending = 1,
    [Description("ارسال شده")] Sent = 2,
    [Description("ناموفق")] Failed = 3,
    [Description("نادیده گرفته شد")] Skipped = 4,
}

/// <summary>وضعیت ارجاع یک تخصیص.</summary>
public enum ReferralState : byte
{
    [Description("فعال")] Active = 1,
    [Description("بازگشت داده شد")] Returned = 2,
    [Description("فراخوانی شد")] Recalled = 3,
    [Description("بسته شده توسط والد")] ClosedByParent = 4,
}

public static class EnumDescriptionExtensions
{
    /// <summary>متن <see cref="DescriptionAttribute"/> یک مقدار enum (در نبود آن، نام عضو).</summary>
    public static string GetDescription(this Enum value)
    {
        var member = value.GetType().GetMember(value.ToString()).FirstOrDefault();
        var attr = member?.GetCustomAttributes(typeof(DescriptionAttribute), false).FirstOrDefault() as DescriptionAttribute;
        return attr?.Description ?? value.ToString();
    }

    /// <summary>فهرست اعضای تکی (تک‌بیتی) یک enum از نوع Flags که در مقدار داده‌شده فعال‌اند.</summary>
    public static IEnumerable<TEnum> GetFlags<TEnum>(this TEnum value) where TEnum : struct, Enum
    {
        var v = Convert.ToInt64(value);
        foreach (var item in Enum.GetValues<TEnum>())
        {
            var bits = Convert.ToInt64(item);
            if (bits != 0 && (bits & (bits - 1)) == 0 && (v & bits) == bits)
                yield return item;
        }
    }
}
