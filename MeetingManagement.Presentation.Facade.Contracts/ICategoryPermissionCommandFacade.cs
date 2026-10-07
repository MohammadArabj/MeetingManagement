using Epc.Company.Query;
using Epc.Core;
using System.Threading.Tasks;
using MeetingManagement.Application.Contracts.CategoryPermission;

namespace MeetingManagement.Presentation.Facade.Contracts;

public interface ICategoryPermissionCommandFacade : IFacadeService
{
    Task<Result<bool>> SetPermissionsAsync(SetCategoryPermissionDto command);
}
