using Epc.Application.Query;
using Epc.Dapper;
using Epc.Identity;
using Microsoft.EntityFrameworkCore;
using UserManagement.Application.Contract.SearchModels;
using UserManagement.Application.Contract.ViewModels;
using UserManagement.Infrastructure.Persistence;
using UserManagement.Infrastructure.Query.Contract;
using UserManagement.Infrastructure.Query.Contract.Permission;

namespace UserManagement.Infrastructure.Query;

public class PermissionQueryHandler(UserManagementQueryContext context, BaseDapperRepository repository,IClaimHelper claimHelper)
    :
        IQueryHandler<List<PermissionViewModel>, PermissionSearchModel>,
        IQueryHandlerAsync<PermissionClassificationLevelViewModel, PermissionClassificationLevelSearchModel>,
        IQueryHandler<string, PermissionRequestDto>,
    IQueryHandler<List<PermissionViewModel>,SystemPermissionRequest>,
    IQueryHandler<List<PermissionTreeNodeViewModel>, Guid?>,
IQueryHandler<PermissionTreeNodeViewModel, Guid>
{

    public List<PermissionViewModel> Handle(PermissionSearchModel searchModel)
    {
        return (from permission in context.Permissions
                join classification in context.ClassificationLevels on
                    permission.ClassificationLevelId equals classification.Id
                join system in context.Systems on
                    permission.SystemId equals system.Id
                where permission.IsPage == true && system.Guid == searchModel.SystemGuid
                select new PermissionViewModel
                {
                    Guid = permission.Guid,
                    Name = permission.Name,
                    ClassificationLevelGuid = classification.Guid
                }).AsNoTracking()
            .ToList();

        //  return _repository.Select<PermissionViewModel>($@"SELECT 
        //  F.Guid,
        //  F.Name,
        //  ClassificationLevelGuid = CL.Guid
        // FROM tbPermissions AS F 
        //  JOIN tbClassificationLevel AS CL ON 
        //   F.ClassificationLevelId = CL.ID
        // WHERE F.IsPage = 1");
    }

    public async Task<PermissionClassificationLevelViewModel> Handle(
        PermissionClassificationLevelSearchModel searchModel)
    {
        var userClassification =
            await context.ClassificationLevels.FirstAsync(x => x.Guid == searchModel.UserClassificationLevelGuid);

        var permissionClassification = await (from permission in context.Permissions
                join cl in context.ClassificationLevels on
                    permission.ClassificationLevelId equals cl.Id
                where permission.Title == searchModel.PermissionTitle
                select new { cl.Title, cl.Level })
            .FirstOrDefaultAsync();

        if (permissionClassification is null) return null;

        if (userClassification.Level >= permissionClassification.Level)
            return new PermissionClassificationLevelViewModel(permissionClassification.Title);

        return null;
    }

    /// <summary>
    /// دسترسی‌های یک سمت در یک سامانه.
    /// فقط برای سمتی که متعلق به کاربر جاری است و فقط دسترسی‌های همان سامانه (ClientId) برگردانده می‌شود؛
    /// قبلاً دسترسی‌های هر سمتی، از همه‌ی سامانه‌ها، برای هر کاربری قابل دریافت بود.
    /// (برای تفویض از GetDelegationPermissions استفاده می‌شود؛ مدیر کل و دارندگان دسترسی «ورود به جای کاربر»
    /// دسترسی‌های سمت هر کاربری را می‌گیرند.)
    /// </summary>
    public string Handle(PermissionRequestDto request)
    {
        var userGuid = claimHelper.GetCurrentUserGuid();
        var system = context.Systems.AsNoTracking().FirstOrDefault(c => c.ClientId == request.ClientId);
        var position = context.Positions.AsNoTracking().FirstOrDefault(c => c.Guid == request.PositionGuid);
        if (system is null || position is null) return string.Empty;

        var ownsPosition = context.UserPositions.AsNoTracking()
            .Any(up => up.PositionId == position.Id && up.User.Guid == userGuid);
        // «ورود به جای کاربر»: فقط برای مدیر کل / دارندگان دسترسی ImpersonationPolicy
        if (!ownsPosition && !ImpersonationPolicy.CanImpersonate(context, userGuid)) return string.Empty;

        var groupIds = context.PositionGroups.AsNoTracking().Where(x => x.PositionId == position.Id).Select(c => c.GroupId);
        var positionPermissionIds = context.PositionPermissions.AsNoTracking().Where(c => c.PositionId == position.Id).Select(c => c.PermissionId);
        var groupPermissionIds = context.GroupPermissions.AsNoTracking().Where(c => groupIds.Contains(c.GroupId)).Select(c => c.PermissionId);

        var permissions = context.Permissions.AsNoTracking()
            .Where(c => c.SystemId == system.Id && (positionPermissionIds.Contains(c.Id) || groupPermissionIds.Contains(c.Id)))
            .Select(c => c.Title)
            .Distinct()
            .ToList();
        return string.Join(",", permissions);
    }

    public List<PermissionViewModel> Handle(SystemPermissionRequest condition)
    {
        var permissions = (from permission in context.Permissions
                           join system in context.Systems on
                               permission.SystemId equals system.Id
                           where system.Guid == condition.SystemGuid
                           select new PermissionViewModel
                           {
                               Guid = permission.Guid,
                               Name = permission.Name,
                               Parent=(permission.ParentId??0).ToString(),
                               Id=permission.Id

                           }).AsNoTracking()
            .ToList(); 
        return permissions;
    }

    // ✅ اضافه شد: کل درخت دسترسی‌ها (یا فقط یک سیستم اگر systemGuid داده شود)
    List<PermissionTreeNodeViewModel> IQueryHandler<List<PermissionTreeNodeViewModel>, Guid?>.Handle(Guid? systemGuid)
    {
        var query = context.Permissions.Include(p => p.IpRestrictions).AsQueryable();

        if (systemGuid.HasValue)
        {
            var systemId = context.Systems.Where(s => s.Guid == systemGuid.Value).Select(s => s.Id).FirstOrDefault();
            query = query.Where(p => p.SystemId == systemId);
        }

        var list = query.AsNoTracking().ToList();
        var idToGuid = list.ToDictionary(p => p.Id, p => p.Guid);
        var systemGuidsById = context.Systems.Select(s => new { s.Id, s.Guid }).ToDictionary(s => s.Id, s => s.Guid);

        return list.Select(p => new PermissionTreeNodeViewModel
        {
            Guid = p.Guid,
            Title = p.Title,
            Name = p.Name,
            ParentGuid = p.ParentId.HasValue && idToGuid.ContainsKey(p.ParentId.Value) ? idToGuid[p.ParentId.Value] : (Guid?)null,
            SystemGuid = systemGuidsById.TryGetValue(p.SystemId, out var sg) ? sg : Guid.Empty,
            IsPage = p.IsPage ?? false,
            Sort = p.Sort,
            IpRestrictions = p.IpRestrictions.Select(r => new PermissionIpRestrictionViewModel
            {
                Id = r.Id,
                StartIp = r.StartIp,
                EndIp = r.EndIp,
            }).ToList(),
        }).ToList();
    }

    // ✅ اضافه شد: جزئیات یک دسترسی برای فرم ویرایش
    PermissionTreeNodeViewModel IQueryHandler<PermissionTreeNodeViewModel, Guid>.Handle(Guid guid)
    {
        var p = context.Permissions.Include(x => x.IpRestrictions).AsNoTracking().FirstOrDefault(x => x.Guid == guid);
        if (p == null) return null;

        var systemGuid = context.Systems.Where(s => s.Id == p.SystemId).Select(s => s.Guid).FirstOrDefault();
        var parentGuid = p.ParentId.HasValue
            ? context.Permissions.Where(x => x.Id == p.ParentId.Value).Select(x => (Guid?)x.Guid).FirstOrDefault()
            : null;

        return new PermissionTreeNodeViewModel
        {
            Guid = p.Guid,
            Title = p.Title,
            Name = p.Name,
            ParentGuid = parentGuid,
            SystemGuid = systemGuid,
            IsPage = p.IsPage ?? false,
            Sort = p.Sort,
            IpRestrictions = p.IpRestrictions.Select(r => new PermissionIpRestrictionViewModel
            {
                Id = r.Id,
                StartIp = r.StartIp,
                EndIp = r.EndIp,
            }).ToList(),
        };
    }
}