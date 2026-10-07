using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.CategoryPermission;
using MeetingManagement.Domain.CategoryAgg;
using MeetingManagement.Domain.Shared.Acls.UserManagement;
using MeetingManagement.Infrastructure.Persistence;
using MeetingManagement.Infrastructure.Query.Contracts.Category;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace MeetingManagement.Infrastructure.Query;

public class CategoryPermissionQueryHandler(
    MeetingManagementQueryContext context,
    IUserManagementAclService userManagementAclService)
    : IQueryHandlerAsync<Result<List<CategoryPermissionDto>>, int>,
     IQueryHandlerAsync<Result<List<CategoryPermissionDto>>, Guid>,
    IQueryHandlerAsync<Result<bool>, CheckCategoryAccessDto>
{
    public async Task<Result<List<CategoryPermissionDto>>> Handle(int categoryId)
    {
        var permissions = await context.CategoryPermissions
            .Where(cp => cp.CategoryId == categoryId)
            .Select(cp => new CategoryPermissionDto
            {
                CategoryId = cp.CategoryId,
                PositionGuid = cp.PositionGuid,
            })
            .ToListAsync();

        // دریافت عنوان سمت‌ها
        var positionGuids = permissions.Select(p => p.PositionGuid).ToList();
        //var positions = await userManagementAclService.GetPositionsByGuidsAsync(positionGuids);

        //foreach (var permission in permissions)
        //{
        //    var position = positions.FirstOrDefault(p => p.Guid == permission.UserGuid);
        //    permission.PositionTitle = position?.Title ?? "نامشخص";
        //}

        return Result<List<CategoryPermissionDto>>.Success(permissions);
    }

    public async Task<Result<bool>> Handle(CheckCategoryAccessDto command)
    {
        var hasAccess = await context.CategoryPermissions
            .AnyAsync(cp => cp.CategoryId == command.CategoryId &&
                            cp.PositionGuid == command.PositionGuid );

        return Result<bool>.Success(hasAccess);
    }

    public async Task<Result<List<CategoryPermissionDto>>> Handle(Guid condition)
    {
        var permissions = await context.CategoryPermissions
            .Where(cp => cp.Category.Guid == condition)
            .Select(cp => new CategoryPermissionDto
            {
                CategoryId = cp.CategoryId,
                PositionGuid = cp.PositionGuid,
            })
            .ToListAsync();

        // دریافت عنوان سمت‌ها
        var positionGuids = permissions.Select(p => p.PositionGuid).ToList();
        //var positions = await userManagementAclService.GetPositionsByGuidsAsync(positionGuids);

        //foreach (var permission in permissions)
        //{
        //    var position = positions.FirstOrDefault(p => p.Guid == permission.UserGuid);
        //    permission.PositionTitle = position?.Title ?? "نامشخص";
        //}

        return Result<List<CategoryPermissionDto>>.Success(permissions);
    }
}