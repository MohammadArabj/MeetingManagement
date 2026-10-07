namespace MeetingManagement.Common.Security;

/// <summary>
/// کد دسترسی‌های سیستمی سامانه جلسات (همان عنوان Permission در UserManagement).
/// هر جا در کد به دسترسی نیاز است از این ثابت‌ها استفاده شود، نه رشته‌ی دستی.
/// </summary>
public static class Permissions
{
    /// <summary>
    /// «ادمین مدیریت جلسات»: دسترسی کامل به همه‌ی بخش‌های همین سامانه در همه‌ی وضعیت‌ها
    /// (همه‌ی دسترسی‌های MT_*، عبور از قفل وضعیت جلسه، مشاهده‌ی همه‌ی جلسات و پیش‌نویس‌ها).
    /// به سمت داده می‌شود و از راه تفویض منتقل نمی‌شود. جلسات هیئت مدیره همچنان <see cref="BoardViewAll"/> صریح می‌خواهند.
    /// </summary>
    public const string MeetingAdmin = "MT_Admin";
    /// <summary>«ورود به جای کاربر»: مشاهده و کار با سامانه دقیقاً با سمت و دسترسی‌های کاربر دیگر (پشتیبانی)</summary>
    public const string Impersonate = "MT_Impersonate";

    // ── جلسات ──────────────────────────────────────────────
    public const string Meetings = "MT_Meetings";
    public const string MeetingsInitialRegister = "MT_Meetings_InitialRegister";
    public const string MeetingsFinalRegister = "MT_Meetings_FinalRegister";
    public const string MeetingsEdit = "MT_Meetings_Edit";
    public const string MeetingsDelete = "MT_Meetings_Delete";
    public const string MeetingsCancel = "MT_Meetings_Cancel";
    public const string MeetingsHold = "MT_Meetings_Hold";
    public const string MeetingsFinalize = "MT_Meetings_Finalize";
    public const string MeetingsCommentAndSign = "MT_Meetings_CommentAndSign";
    public const string MeetingsViewAll = "MT_Meetings_ViewAllMeetings";
    public const string MeetingsSearch = "MT_Meetings_Search";
    public const string MeetingsViewCalendar = "MT_Meetings_ViewCalendar";
    public const string MeetingsViewFiles = "MT_Meetings_ViewFiles";

    // ── مصوبات ─────────────────────────────────────────────
    public const string Resolutions = "MT_Resolutions";
    public const string ResolutionsAdd = "MT_Resolutions_Add";
    public const string ResolutionsEdit = "MT_Resolutions_Edit";
    public const string ResolutionsDelete = "MT_Resolutions_Delete";
    public const string ResolutionsAssign = "MT_Resolutions_Assign";
    public const string ResolutionsViewFiles = "MT_Resolutions_ViewFiles";
    public const string ResolutionsDeleteFiles = "MT_Resolutions_DeleteFiles";
    public const string DescriptionsEdit = "MT_Descriptions_Edit";
    public const string Followups = "MT_Followups";

    // ── هیئت مدیره ─────────────────────────────────────────
    /// <summary>مدیریت اعضای هیئت مدیره (جدول BoardMembers)</summary>
    public const string BoardMembers = "MT_BoardMembers";

    /// <summary>
    /// مشاهده‌ی همه‌ی جلسات و مصوبات هیئت مدیره بدون عضویت در جلسه.
    /// «مشاهده همه جلسات» (<see cref="MeetingsViewAll"/>) و حتی مدیر سامانه به‌تنهایی
    /// به جلسات هیئت مدیره دسترسی نمی‌دهند.
    /// </summary>
    public const string BoardViewAll = "MT_Board_ViewAll";

    // ── اطلاعات پایه و تنظیمات ─────────────────────────────
    public const string Settings = "MT_Settings";
    public const string UserRoles = "MT_UserRoles";
    public const string Categories = "MT_Categories";
    public const string ResolutionLabels = "MT_ResolutionLabels";
    public const string Statuses = "MT_Statuses";
    public const string Locations = "MT_Locations";
    public const string UsersViewAll = "MT_User_ViewAll";
    public const string Archive = "MT_Archive";
    public const string PrintTemplates = "MT_PrintTemplates";
}
