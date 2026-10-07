using Microsoft.AspNetCore.Mvc.Rendering;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Reflection;

namespace MeetingManagement.Common.Extensions;

public static class ExtensionEnum
{
    public static string GetDisplayName(this Enum enumValue)
    {
        if (enumValue == null)
            return string.Empty; // یا null، بسته به نیازت

        var type = enumValue.GetType();

        // چک معتبر بودن مقدار enum
        if (!Enum.IsDefined(type, enumValue))
        {
            // fallback برای invalid (مثل 0): مقدار عددی رو برگردون یا "نامعتبر"
            return string.Empty; // برای 0، "0" برمی‌گردونه
            // یا اگر می‌خوای متن فارسی: return "نامعتبر";
        }

        var memberName = enumValue.ToString();
        var members = type.GetMember(memberName);

        // فرض می‌کنیم members.Length > 0 چون IsDefined true هست
        var displayAttr = members[0].GetCustomAttribute<DisplayAttribute>();
        return displayAttr?.GetName() ?? memberName; // اگر attr نبود، نام عضو رو بده
    }

    public static List<SelectListItem> EnumToSelectList<T>()
    {
        return (Enum.GetValues(typeof(T)).Cast<T>().Select(
            e => new SelectListItem()
            {
                Text = e.GetType()
                    .GetMember(e.ToString())
                    .First()
                    .GetCustomAttribute<DisplayAttribute>()
                    .GetName(),

                Value = e.ToString()
            })).ToList();
    }

    public static List<T> GetEnumValues<T>() where T : struct
    {
        if (!typeof(T).IsEnum)
        {
            throw new ArgumentException("GetValues<T> can only be called for types derived from System.Enum", "T");
        }
        return Enum.GetValues(typeof(T))
            .Cast<T>()
            .ToList();
    }

    public static List<T> ToListEnum<T>(string s) where T : struct
    {
        if (s == null)
            return new List<T>();

        var date = s.ToString();
        if (string.IsNullOrEmpty(date))
            return new List<T>();

        return s.Split(',').Select(x => (T)Enum.Parse(typeof(T), x)).ToList();
    }

    public static T? ToEnum<T>(string s) where T : struct
    {
        if (s == null)
            return null;

        var date = s.ToString();
        if (string.IsNullOrEmpty(date))
            return null;

        return (T)Enum.Parse(typeof(T), s);
    }
}

//جهت پیگیری، تهیه گزارش، استحضار، اطلاع، اقدام

public enum AssignmentType : byte
{
    [Display(Name = "جهت پیگیری")]
    FollowUp = 1,
    [Display(Name = "تهیه گزارش")]
    ReportPreparation = 2,

    [Display(Name = "استحضار")]
    Notification = 3,

    [Display(Name = "اطلاع")]
    Information = 4,

    [Display(Name = "اقدام")]
    Action = 5,
    [Display(Name = "جهت کارشناسی")]
    Expert= 6
}

public enum ResolutionStatus : byte
{
    [Display(Name = "انجام شده")]
    Completed = 1,
    [Display(Name = "در حال انجام")]
    InProgress = 2,
    [Display(Name = "لغو شده")]
    Canceled = 3
}

public enum FileType : byte
{
    Meeting = 1,
    Resolution=2,
    Agenda=3
}

public enum ActionType : byte
{
    Follow=1,
    Action
}

public enum Gender : byte
{
    Male=1,
    Female=2
}
public enum ActionFollowStatus:byte
{
    [Display(Name = "در انتظار پیگیری")]
    Pending = 1,   // در انتظار بررسی
    [Display(Name = "درحال پیگیری")]
    InProgress,  // تأیید شده
    [Display(Name = "پایان پیگیری")]
    End   // رد شده
}
public enum ActionStatus:byte
{
    [Display(Name = "درانتظار اقدام")]
    Pending = 1,
    [Display(Name = "در حال انجام")]
    InProgress,
    [Display(Name = "پایان یافته")]
    End,
    Overdue
}

public enum AssignmentResult : byte
{
    [Display(Name = "انجام شده")]
    Done=1,
    [Display(Name = "انجام نشده")]
    NotDone
}
public enum ReportType : byte
{
    Yearly=1,
    Monthly,
    Weekly,
}


public enum FilterType : byte
{
    All = 1,
    Today,
    Upcoming,
    Signature,
    Finished,
    Draft,
    Canceled,
    Attendance,
    Undetermined,
    /// <summary>بایگانی: جلسات اتمام‌یافته</summary>
    Archived
}

public enum NotificationChannel
{
    SMS = 1,
    Email  ,
    System 
}
public enum NotificationTriggerType
{
    EventBased = 1,
    Reminder = 2
}



public enum SettingKey : byte
{
    // ═══════════════════════════════════════════════════════════
    // تنظیمات هیئت مدیره
    // ═══════════════════════════════════════════════════════════
    [Description("کد دسته‌بندی هیئت مدیره")]
    BoardCategoryGuid = 1,

    [Description("کد سمت هیئت مدیره")]
    BoardPositionGuid = 2,

    [Description("کد کاربر دبیر هیئت مدیره")]
    BoardSecretaryUserGuid = 3,

    // ═══════════════════════════════════════════════════════════
    // تنظیمات کمیسیون معاملات
    // ═══════════════════════════════════════════════════════════
    [Description("کد دسته‌بندی کمیسیون معاملات")]
    CommitteeCategoryGuid = 4,

    // ═══════════════════════════════════════════════════════════
    // تنظیمات جلسه
    // ═══════════════════════════════════════════════════════════
    [Description("مدت زمان اتمام خودکار جلسه پس از امضا (دقیقه)")]
    MeetingAutoCloseMinutes = 7,

    [Description("حداکثر تعداد فایل پیوست در هر مصوبه")]
    MaxResolutionAttachments = 8,

    [Description("حداکثر حجم فایل پیوست (مگابایت)")]
    MaxAttachmentSizeMB = 9,

    // ═══════════════════════════════════════════════════════════
    // تنظیمات سیستم
    // ═══════════════════════════════════════════════════════════
    [Description("کد سیستم")]
    SystemGuid = 10,

    [Description("آدرس پنل پیامک")]
    SmsUrl = 11,

    [Description("نام سیستم")]
    SystemName = 12,

    // ═══════════════════════════════════════════════════════════
    // تنظیمات نوتیفیکیشن
    // ═══════════════════════════════════════════════════════════
    [Description("فعال بودن ارسال پیامک")]
    SmsEnabled = 13,

    [Description("فرمت های مجاز آپلود فایل")]
    AllowedFileExtensions = 14,

    // ═══════════════════════════════════════════════════════════
    // کلیدهای جدید (فقط ردیف جدید در جدول SystemSettings؛ بدون تغییر اسکیما)
    // ═══════════════════════════════════════════════════════════
    [Description("پیکربندی نقش‌های جلسه و توانایی‌ها (JSON)")]
    MeetingRoleConfig = 15,

    [Description("نگاشت کد رویدادهای اطلاع‌رسانی به شناسه جدول (JSON)")]
    NotificationEventMap = 16,

    [Description("آدرس عمومی سامانه (برای لینک در پیامک)")]
    SystemBaseUrl = 17,

    [Description("یادآوری جلسه - چند ساعت قبل")]
    MeetingReminderHoursBefore = 18,

    [Description("یادآوری سررسید تخصیص - چند روز قبل")]
    AssignmentDueReminderDaysBefore = 19,

    [Description("حداکثر تعداد تلاش مجدد ارسال")]
    NotificationMaxRetry = 20,

    [Description("شروع ساعات سکوت پیامک (HH:mm)")]
    NotificationQuietStart = 21,

    [Description("پایان ساعات سکوت پیامک (HH:mm)")]
    NotificationQuietEnd = 22,

    [Description("حداکثر عمق زنجیره ارجاع")]
    ReferralMaxDepth = 23,

    [Description("اجازه سررسید ارجاع دیرتر از سررسید تخصیص والد")]
    ReferralAllowLaterDueDate = 24,

    [Description("فعال بودن اعلان داخل سامانه")]
    InAppNotificationEnabled = 25,

    [Description("حالت آزمایشی پیامک (فقط ثبت لاگ، بدون ارسال واقعی)")]
    SmsTestMode = 26,

    [Description("آخرین زمان اجرای Job یادآوری (داخلی)")]
    NotificationReminderWatermark = 27,

    // ═══════════════════════════════════════════════════════════
    // چاپ (بدون تغییر اسکیما: محتوای قالب‌ها در سامانه مدیریت فایل و فقط شناسه‌ها اینجا)
    // ═══════════════════════════════════════════════════════════
    [Description("اطلاعات سربرگ چاپ (JSON: نام شرکت، لوگو، آدرس، رنگ، ...)")]
    PrintBranding = 28,

    [Description("قالب‌های سفارشی چاپ (JSON: کلید قالب ← شناسه فایل)")]
    PrintTemplates = 29,

    [Description("تعیین تکلیف نشده خودکار - چند روز پس از تاریخ جلسه (0 = غیرفعال)")]
    MeetingUndeterminedAfterDays = 30,
}

public enum SettingValueType : byte
{
    [Description("متن")]
    String = 1,

    [Description("عدد صحیح")]
    Integer = 2,

    [Description("بولین")]
    Boolean = 3,

    [Description("شناسه یکتا")]
    Guid = 4,

    [Description("عدد اعشاری")]
    Decimal = 5,

    [Description("JSON")]
    Json = 6,

    [Description("ساعت (HH:mm)")]
    Time = 7,
}

public enum SettingCategory : byte
{
    [Description("عمومی")]
    General = 1,

    [Description("جلسات")]
    Meeting = 2,

    [Description("هیئت مدیره")]
    BoardMeeting = 3,

    [Description("نوتیفیکیشن")]
    Notification = 4,

    [Description("مدیریت فایل")]
    FileManagement = 5,

    [Description("نقش‌ها و دسترسی‌ها")]
    Roles = 6,

    [Description("مصوبات و پیگیری")]
    Resolution = 7,

    [Description("چاپ و قالب‌ها")]
    Print = 8,
}