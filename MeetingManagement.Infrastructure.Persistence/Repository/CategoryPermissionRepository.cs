using Epc.Domain;
using Epc.EntityFramework;
using MeetingManagement.Domain.BoardMemberAgg;
using MeetingManagement.Domain.CategoryAgg;
using Microsoft.EntityFrameworkCore;
using static Microsoft.AspNetCore.Hosting.Internal.HostingApplication;

namespace MeetingManagement.Infrastructure.Persistence.Repository;

public class CategoryPermissionRepository(MeetingManagementCommandContext commandContext)
    : BaseRepository<int, CategoryPermission>(commandContext), Domain.CategoryAgg.ICategoryPermissionRepository
{
    public async Task<List<CategoryPermission>> GetByCategoryAsync(int categoryId)
    {
        return await commandContext.CategoryPermissions.Where(cp => cp.CategoryId == categoryId).ToListAsync();
    }

    public async Task<bool> HasAccessAsync(int categoryId, Guid positionGuid)
    {
        return await commandContext.CategoryPermissions.AnyAsync(cp => cp.CategoryId == categoryId &&
                                          cp.PositionGuid == positionGuid );
    }
}