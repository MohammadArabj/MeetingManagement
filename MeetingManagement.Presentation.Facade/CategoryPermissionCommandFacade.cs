using System.Threading.Tasks;
using Epc.Application.Command;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.CategoryPermission;
using MeetingManagement.Presentation.Facade.Contracts;

namespace MeetingManagement.Presentation.Facade.Command;

public class CategoryPermissionCommandFacade(IResponsiveCommandBusAsync responsiveCommandBusAsync)
    : ICategoryPermissionCommandFacade
{
    public async Task<Result<bool>> SetPermissionsAsync(SetCategoryPermissionDto command) =>
        await responsiveCommandBusAsync.Dispatch<SetCategoryPermissionDto, Result<bool>>(command);
}