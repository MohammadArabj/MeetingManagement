using System;
using System.Threading.Tasks;
using Epc.Company.Query;
using Epc.Core;
using MeetingManagement.Application.Contracts.Category;

namespace MeetingManagement.Presentation.Facade.Contracts.Category;

public interface ICategoryCommandFacade:IFacadeService
{
    Task<Result<Guid>> Create(CreateCategoryDto command);
    Task<Result<bool>> Edit(EditCategoryDto command);
    Task<Result<bool>> Delete(Guid guid);
    Task<Result<bool>> Activate(Guid guid);
    Task<Result<bool>> Deactivate(Guid guid);
    Task<Result<bool>> SetPermissions(SetCategoryPermissionDto permissions);
}