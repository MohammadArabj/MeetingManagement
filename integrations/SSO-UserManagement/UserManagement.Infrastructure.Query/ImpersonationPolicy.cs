using Microsoft.EntityFrameworkCore;
using UserManagement.Infrastructure.Persistence;

namespace UserManagement.Infrastructure.Query;

/// <summary>
/// «ورود به جای کاربر» (Impersonation) برای پشتیبانی/مدیریت سامانه‌ها.
/// فقط کاربری که سمت مدیر کل (IsSuperAdmin) دارد یا یکی از سمت‌هایش (مستقیم یا از راه گروه) یکی از
/// دسترسی‌های <see cref="PermissionTitles"/> را دارد، می‌تواند سمت‌ها و دسترسی‌های کاربر دیگری را بخواند.
/// سایر کاربران فقط اطلاعات سمت‌های خودشان را می‌گیرند.
/// </summary>
public static class ImpersonationPolicy
{
    public static readonly string[] PermissionTitles = ["MT_Admin", "MT_Impersonate"];

    public static async Task<bool> CanImpersonateAsync(UserManagementQueryContext context, Guid userGuid)
    {
        var positionIds = context.UserPositions.AsNoTracking()
            .Where(up => up.User.Guid == userGuid)
            .Select(up => up.PositionId);

        if (await context.Positions.AsNoTracking().AnyAsync(p => positionIds.Contains(p.Id) && p.IsSuperAdmin))
            return true;

        var groupIds = context.PositionGroups.AsNoTracking().Where(pg => positionIds.Contains(pg.PositionId)).Select(pg => pg.GroupId);
        var permissionIds = context.PositionPermissions.AsNoTracking().Where(pp => positionIds.Contains(pp.PositionId)).Select(pp => pp.PermissionId)
            .Concat(context.GroupPermissions.AsNoTracking().Where(gp => groupIds.Contains(gp.GroupId)).Select(gp => gp.PermissionId));

        return await context.Permissions.AsNoTracking()
            .AnyAsync(p => permissionIds.Contains(p.Id) && PermissionTitles.Contains(p.Title));
    }

    public static bool CanImpersonate(UserManagementQueryContext context, Guid userGuid)
        => CanImpersonateAsync(context, userGuid).GetAwaiter().GetResult();
}
