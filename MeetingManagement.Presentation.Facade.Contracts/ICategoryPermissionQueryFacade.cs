using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Epc.Company.Query;
using Epc.Core;
using MeetingManagement.Application.Contracts.CategoryPermission;

namespace MeetingManagement.Presentation.Facade.Contracts;

public interface ICategoryPermissionQueryFacade : IFacadeService
{
    Task<Result<List<CategoryPermissionDto>>> GetByCategoryAsync(int categoryId);
    Task<Result<List<CategoryPermissionDto>>> GetByCategoryAsync(Guid categoryGuid);
    Task<Result<bool>> CheckAccessAsync(int categoryId, Guid positionGuid);
}