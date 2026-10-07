using Epc.Domain;

namespace MeetingManagement.Domain.CategoryAgg;

public interface ICategoryPermissionRepository:IRepository<int,CategoryPermission>
{
    Task<List<CategoryPermission>> GetByCategoryAsync(int categoryId);
    Task<bool> HasAccessAsync(int categoryId, Guid positionGuid);
}