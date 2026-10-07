using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.Shared.Access;
using MeetingManagement.Domain.Shared.Notifications;

namespace MeetingManagement.Domain.SettingAgg;

/// <summary>
/// مقادیر استاتیک تنظیمات - برای دسترسی سریع بدون نیاز به دیتابیس.
/// با هر تغییر تنظیمات از طریق API، مقدار مربوطه همین‌جا به‌روز می‌شود.
/// (سرور تک‌نمونه‌ای است؛ در صورت چند نمونه‌ای شدن باید به Distributed Cache منتقل شود.)
/// </summary>
public static class SettingValues
{
    private static readonly object _lock = new();
    private static bool _isInitialized;

    // ── هیئت مدیره ─────────────────────────────────────────
    public static Guid BoardCategoryGuid { get; private set; }
    public static Guid BoardPositionGuid { get; private set; }
    public static Guid BoardSecretaryUserGuid { get; private set; }

    // ── کمیسیون معاملات ────────────────────────────────────
    public static Guid CommitteeCategoryGuid { get; private set; }

    // ── جلسه ──────────────────────────────────────────────
    public static int MeetingAutoCloseMinutes { get; private set; } = 30;
    /// <summary>جلسات «ثبت اولیه/برگزار شده» چند روز پس از تاریخشان «تعیین تکلیف نشده» شوند (0 = غیرفعال)</summary>
    public static int MeetingUndeterminedAfterDays { get; private set; }
    public static int MaxResolutionAttachments { get; private set; } = 10;
    public static int MaxAttachmentSizeMB { get; private set; } = 50;

    // ── سیستم ─────────────────────────────────────────────
    public static Guid SystemGuid { get; private set; }
    public static string SmsUrl { get; private set; } = string.Empty;
    public static string SystemName { get; private set; } = "سامانه مدیریت جلسات";
    public static string SystemBaseUrl { get; private set; } = string.Empty;

    // ── اطلاع‌رسانی ───────────────────────────────────────
    public static bool SmsEnabled { get; private set; } = true;
    public static bool SmsTestMode { get; private set; }
    public static bool InAppNotificationEnabled { get; private set; } = true;
    public static string AllowedFileExtensions { get; private set; } = string.Empty;
    public static int MeetingReminderHoursBefore { get; private set; } = 24;
    public static int AssignmentDueReminderDaysBefore { get; private set; } = 2;
    public static int NotificationMaxRetry { get; private set; } = 3;
    public static TimeSpan? NotificationQuietStart { get; private set; }
    public static TimeSpan? NotificationQuietEnd { get; private set; }
    public static string NotificationEventMapJson { get; private set; } = string.Empty;

    // ── مصوبات و ارجاع ────────────────────────────────────
    public static int ReferralMaxDepth { get; private set; } = 5;
    public static bool ReferralAllowLaterDueDate { get; private set; }

    // ── نقش‌ها ────────────────────────────────────────────
    public static string MeetingRoleConfigJson { get; private set; } = string.Empty;

    // ── وضعیت ─────────────────────────────────────────────
    public static bool IsInitialized => _isInitialized;
    public static DateTime? LastUpdated { get; private set; }

    /// <summary>بارگذاری اولیه تنظیمات از دیتابیس</summary>
    public static void Initialize(IEnumerable<SystemSetting> settings)
    {
        lock (_lock)
        {
            foreach (var setting in settings)
                SetValue(setting.Key, setting.Value);

            _isInitialized = true;
            LastUpdated = DateTime.Now;
        }
    }

    /// <summary>آپدیت یک تنظیم خاص</summary>
    public static void Update(SettingKey key, string value)
    {
        lock (_lock)
        {
            SetValue(key, value);
            LastUpdated = DateTime.Now;
        }
    }

    /// <summary>آپدیت چند تنظیم</summary>
    public static void UpdateMany(IEnumerable<(SettingKey Key, string Value)> settings)
    {
        lock (_lock)
        {
            foreach (var (key, value) in settings)
                SetValue(key, value);

            LastUpdated = DateTime.Now;
        }
    }

    /// <summary>آیا الان در بازه سکوت پیامک هستیم؟ (بازه می‌تواند از نیمه‌شب عبور کند)</summary>
    public static bool IsInQuietHours(DateTime now)
    {
        if (NotificationQuietStart is not { } start || NotificationQuietEnd is not { } end || start == end)
            return false;

        var t = now.TimeOfDay;
        return start < end ? t >= start && t < end : t >= start || t < end;
    }

    private static void SetValue(SettingKey key, string? value)
    {
        switch (key)
        {
            case SettingKey.BoardCategoryGuid: BoardCategoryGuid = ParseGuid(value); break;
            case SettingKey.BoardPositionGuid: BoardPositionGuid = ParseGuid(value); break;
            case SettingKey.BoardSecretaryUserGuid: BoardSecretaryUserGuid = ParseGuid(value); break;
            case SettingKey.CommitteeCategoryGuid: CommitteeCategoryGuid = ParseGuid(value); break;

            case SettingKey.MeetingAutoCloseMinutes: MeetingAutoCloseMinutes = ParseInt(value, 30); break;
            case SettingKey.MeetingUndeterminedAfterDays: MeetingUndeterminedAfterDays = Math.Max(0, ParseInt(value, 0)); break;
            case SettingKey.MaxResolutionAttachments: MaxResolutionAttachments = ParseInt(value, 10); break;
            case SettingKey.MaxAttachmentSizeMB: MaxAttachmentSizeMB = ParseInt(value, 50); break;

            case SettingKey.SystemGuid: SystemGuid = ParseGuid(value); break;
            case SettingKey.SmsUrl: SmsUrl = value ?? string.Empty; break;
            case SettingKey.SystemName: SystemName = string.IsNullOrWhiteSpace(value) ? "سامانه مدیریت جلسات" : value; break;
            case SettingKey.SystemBaseUrl: SystemBaseUrl = (value ?? string.Empty).TrimEnd('/'); break;

            case SettingKey.SmsEnabled: SmsEnabled = ParseBool(value, true); break;
            case SettingKey.SmsTestMode: SmsTestMode = ParseBool(value, false); break;
            case SettingKey.InAppNotificationEnabled: InAppNotificationEnabled = ParseBool(value, true); break;
            case SettingKey.AllowedFileExtensions: AllowedFileExtensions = value ?? string.Empty; break;
            case SettingKey.MeetingReminderHoursBefore: MeetingReminderHoursBefore = ParseInt(value, 24); break;
            case SettingKey.AssignmentDueReminderDaysBefore: AssignmentDueReminderDaysBefore = ParseInt(value, 2); break;
            case SettingKey.NotificationMaxRetry: NotificationMaxRetry = Math.Clamp(ParseInt(value, 3), 0, 10); break;
            case SettingKey.NotificationQuietStart: NotificationQuietStart = ParseTime(value); break;
            case SettingKey.NotificationQuietEnd: NotificationQuietEnd = ParseTime(value); break;
            case SettingKey.NotificationEventMap:
                NotificationEventMapJson = value ?? string.Empty;
                NotificationEventMap.Load(NotificationEventMapJson);
                break;

            case SettingKey.ReferralMaxDepth: ReferralMaxDepth = Math.Clamp(ParseInt(value, 5), 1, 20); break;
            case SettingKey.ReferralAllowLaterDueDate: ReferralAllowLaterDueDate = ParseBool(value, false); break;

            case SettingKey.MeetingRoleConfig:
                MeetingRoleConfigJson = value ?? string.Empty;
                MeetingRoles.Load(MeetingRoleConfigJson);
                break;
        }
    }

    private static Guid ParseGuid(string? value) => Guid.TryParse(value, out var r) ? r : Guid.Empty;
    private static int ParseInt(string? value, int d) => int.TryParse(value, out var r) ? r : d;
    private static bool ParseBool(string? value, bool d) => bool.TryParse(value, out var r) ? r : d;
    private static TimeSpan? ParseTime(string? value) => TimeSpan.TryParse(value, out var r) ? r : null;
}
