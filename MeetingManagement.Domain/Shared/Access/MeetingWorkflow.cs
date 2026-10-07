using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.SettingAgg;

namespace MeetingManagement.Domain.Shared.Access;

/// <summary>
/// شناسه‌های وضعیت جلسه (جدول MeetingStatuses) — تنها محل تعریف این اعداد.
/// </summary>
public static class MeetingStatusIds
{
    public const int Draft = 1;          // پیش‌نویس
    public const int Registered = 2;     // ثبت اولیه
    public const int Held = 3;           // برگزار شده
    public const int Finalized = 4;      // ثبت نهایی
    public const int Cancelled = 5;      // لغو شده
    public const int Completed = 6;      // اتمام یافته
    public const int Undetermined = 7;   // تعیین تکلیف نشده

    /// <summary>وضعیت‌هایی که جلسه در آن‌ها «بسته» است و محتوایش دیگر تغییر نمی‌کند</summary>
    public static readonly int[] Closed = [Cancelled, Completed];

    /// <summary>
    /// انتقال‌های مجاز وضعیت. هر انتقالی خارج از این جدول در سرور رد می‌شود.
    /// </summary>
    public static bool CanTransition(int from, int to) => (from, to) switch
    {
        (Draft, Registered) => true,
        (Draft or Registered or Undetermined, Cancelled) => true,
        (Cancelled, Registered) => true,    // فعال‌سازی مجدد جلسه‌ی لغو شده
        (Registered or Undetermined, Held) => true,
        (Registered or Held, Undetermined) => true,
        (Held, Finalized) => true,
        (Finalized, Held) => true,          // بازگشت برای اصلاح صورتجلسه (پیش از امضای رئیس)
        (Finalized, Completed) => true,
        (Registered or Held, Completed) => true, // فقط برای جلسات بدون صورتجلسه (هیئت مدیره) — در Handler کنترل می‌شود
        _ => false,
    };
}

/// <summary>
/// تشخیص نوع جلسه از روی دسته‌بندی.
/// چون اسکیما تغییر نمی‌کند، نوع جلسه از تنظیمات (BoardCategoryGuid / CommitteeCategoryGuid) خوانده می‌شود،
/// اما فقط در همین یک نقطه — بقیه‌ی کد فقط با <see cref="MeetingKind"/> کار می‌کند.
/// </summary>
public static class MeetingKinds
{
    public static MeetingKind Of(Guid? categoryGuid)
    {
        if (categoryGuid is null || categoryGuid == Guid.Empty) return MeetingKind.Regular;
        if (categoryGuid == SettingValues.BoardCategoryGuid) return MeetingKind.Board;
        if (categoryGuid == SettingValues.CommitteeCategoryGuid) return MeetingKind.Committee;
        return MeetingKind.Regular;
    }

    public static bool IsBoard(Guid? categoryGuid) => Of(categoryGuid) == MeetingKind.Board;
}

/// <summary>
/// گردش‌کار هر نوع جلسه: مراحل وضعیت و قوانین ویرایش محتوا.
/// برای افزودن نوع جدید فقط کافی است یک case به این کلاس اضافه شود.
/// </summary>
public sealed class MeetingWorkflow
{
    public required MeetingKind Kind { get; init; }

    /// <summary>مراحل نمایش داده‌شده در نوار وضعیت (به ترتیب)</summary>
    public required int[] Steps { get; init; }

    /// <summary>وضعیت‌هایی که در آن ثبت/ویرایش مصوبه مجاز است</summary>
    public required int[] ResolutionEditableStatuses { get; init; }

    /// <summary>آیا پس از امضای رئیس، محتوا قفل می‌شود؟</summary>
    public required bool LockContentAfterChairmanSign { get; init; }

    /// <summary>آیا تب حضور و غیاب / اعلام حضور دارد؟</summary>
    public required bool HasAttendance { get; init; }

    /// <summary>آیا صورتجلسه (امضا) دارد؟</summary>
    public required bool HasMinutes { get; init; }

    /// <summary>آیا پیگیری‌کننده‌ی تخصیص‌ها ثابت (دبیر هیئت مدیره) است؟</summary>
    public required bool FixedFollower { get; init; }

    public static MeetingWorkflow For(MeetingKind kind) => kind switch
    {
        MeetingKind.Board => new MeetingWorkflow
        {
            Kind = kind,
            Steps = [MeetingStatusIds.Registered, MeetingStatusIds.Held, MeetingStatusIds.Completed],
            ResolutionEditableStatuses = [MeetingStatusIds.Registered, MeetingStatusIds.Held, MeetingStatusIds.Finalized, MeetingStatusIds.Completed],
            LockContentAfterChairmanSign = false,
            HasAttendance = false,
            HasMinutes = false,
            FixedFollower = true,
        },
        _ => new MeetingWorkflow
        {
            Kind = kind,
            Steps = [MeetingStatusIds.Registered, MeetingStatusIds.Held, MeetingStatusIds.Finalized, MeetingStatusIds.Completed],
            ResolutionEditableStatuses = [MeetingStatusIds.Held, MeetingStatusIds.Finalized],
            LockContentAfterChairmanSign = true,
            HasAttendance = true,
            HasMinutes = true,
            FixedFollower = false,
        },
    };
}
