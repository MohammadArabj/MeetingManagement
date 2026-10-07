using System;
using System.Linq;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Common.Security;
using MeetingManagement.Domain.AssignmentAgg;
using MeetingManagement.Domain.MeetingAgg;
using MeetingManagement.Domain.SettingAgg;
using MeetingManagement.Domain.Shared.Access;

namespace MeetingManagement.Infrastructure.Query.Security;

/// <summary>
/// قوانین مشترک «چه کسی چه چیزی را می‌بیند» برای همه‌ی Queryها.
/// هر فهرست، شمارنده و داشبورد باید از همین متدها استفاده کند تا عدد کارتابل و فهرست همیشه یکی باشد.
/// </summary>
public static class QueryScopes
{
    // ═══════════════════════════════════════════════════════════
    // جلسات
    // ═══════════════════════════════════════════════════════════

    /// <summary>
    /// جلساتی که کاربر اجازه‌ی دیدن آن‌ها را دارد:
    ///   • پیش‌نویس: فقط ثبت‌کننده
    ///   • سایر وضعیت‌ها: ثبت‌کننده، اعضا (با سمت، یا کاربر بدون سمت)، جانشین اعضا
    ///   • «مشاهده همه جلسات»: همه‌ی جلسات غیر هیئت مدیره
    ///   • «مشاهده جلسات هیئت مدیره»: همه‌ی جلسات هیئت مدیره (مدیر سامانه به‌تنهایی کافی نیست)
    /// </summary>
    public static IQueryable<Meeting> VisibleTo(this IQueryable<Meeting> query, ActingIdentity identity, bool includeGuests = true)
    {
        var user = identity.UserGuid;
        var position = identity.PositionGuid ?? Guid.Empty;
        var guestId = MeetingRoles.GuestId;
        var boardGuid = SettingValues.BoardCategoryGuid;
        var viewAll = identity.HasPermission(Permissions.MeetingsViewAll);
        var viewBoard = identity.HasExplicitPermission(Permissions.BoardViewAll);
        // ادمین همه‌ی جلسات (حتی پیش‌نویس دیگران) را می‌بیند؛ هیئت مدیره فقط با دسترسی صریح
        var admin = identity.IsSuperAdmin;

        return query.Where(m => m.IsRemoved != true && (
            (admin && (m.Category!.Guid != boardGuid || viewBoard))
            || m.CreatedBy == user || (m.CreatorPositionGuid == position && position != Guid.Empty)
            || (m.StatusId != MeetingStatusIds.Draft && (
                m.MeetingMembers.Any(mm =>
                    (includeGuests || mm.RoleId != guestId) &&
                    ((mm.PositionGuid == position && position != Guid.Empty)
                     || (mm.PositionGuid == null && mm.UserGuid == user)
                     || mm.ReplacementUserGuid == user))
                || (viewAll && m.Category!.Guid != boardGuid)
                || (viewBoard && m.Category!.Guid == boardGuid)))));
    }

    // ═══════════════════════════════════════════════════════════
    // تخصیص‌ها و ارجاع‌ها
    // ═══════════════════════════════════════════════════════════

    /// <summary>
    /// تخصیص‌ها فقط پس از «ابلاغ» دیده می‌شوند:
    ///   • جلسات عادی: پس از امضای رئیس
    ///   • هیئت مدیره (بدون صورتجلسه): پس از اتمام جلسه
    /// جلسات لغوشده یا حذف‌شده هیچ‌وقت در کارتابل نمی‌آیند.
    /// </summary>
    public static IQueryable<Assignment> Published(this IQueryable<Assignment> query)
    {
        var chairmanId = MeetingRoles.ChairmanId;
        var boardGuid = SettingValues.BoardCategoryGuid;

        return query.Where(a =>
            a.IsActive != 0 &&
            a.Resolution.Meeting.IsRemoved != true &&
            a.Resolution.Meeting.StatusId != MeetingStatusIds.Cancelled &&
            (a.Resolution.Meeting.Category!.Guid == boardGuid
                ? a.Resolution.Meeting.StatusId == MeetingStatusIds.Completed
                : a.Resolution.Meeting.MeetingMembers.Any(mm => mm.RoleId == chairmanId && mm.IsSign == true)));
    }

    /// <summary>
    /// ارجاع «باز»: خودش پایان نیافته و والدش هم پایان نیافته.
    /// با پایان تخصیص اصلی، همه‌ی ارجاع‌های زیرمجموعه بسته می‌شوند (در Handler)؛ شرط والد اینجا
    /// تضمین می‌کند حتی داده‌ی قدیمیِ ترمیم‌نشده هم در کارتابل ارجاع‌گیرنده دیده نشود.
    /// </summary>
    public static IQueryable<Assignment> OpenReferrals(this IQueryable<Assignment> query) =>
        query.Where(a => a.IsReferral
                         && a.ActionStatus != ActionStatus.End
                         && (a.ParentAssignment == null || a.ParentAssignment.ActionStatus != ActionStatus.End));

    /// <summary>تخصیص‌های اصلی که کاربر اقدام‌کننده یا پیگیری‌کننده‌ی آن است</summary>
    public static IQueryable<Assignment> OriginalsOf(this IQueryable<Assignment> query, Guid position) =>
        query.Where(a => !a.IsReferral && (a.ActorPositionGuid == position || a.FollowerPositionGuid == position));

    /// <summary>ارجاع‌های باز دریافتی (کاربر اقدام‌کننده‌ی ارجاع است)</summary>
    public static IQueryable<Assignment> ReceivedReferralsOf(this IQueryable<Assignment> query, Guid position) =>
        query.OpenReferrals().Where(a => a.ActorPositionGuid == position);

    /// <summary>ارجاع‌های باز ارسالی (کاربر ارجاع‌دهنده است)</summary>
    public static IQueryable<Assignment> GivenReferralsOf(this IQueryable<Assignment> query, Guid position) =>
        query.OpenReferrals().Where(a => a.ReferrerPositionGuid == position);
}
