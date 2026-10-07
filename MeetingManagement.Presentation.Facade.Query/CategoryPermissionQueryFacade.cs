using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.CategoryPermission;
using MeetingManagement.Presentation.Facade.Contracts;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using MeetingManagement.Infrastructure.Query.Contracts.Category;

namespace MeetingManagement.Presentation.Facade.Query;
public class CategoryPermissionQueryFacade(IQueryBusAsync queryBusAsync) : ICategoryPermissionQueryFacade
{
    public async Task<Result<List<CategoryPermissionDto>>> GetByCategoryAsync(int categoryId) =>
        await queryBusAsync.Dispatch<Result<List<CategoryPermissionDto>>, int>(categoryId);

    public async Task<Result<List<CategoryPermissionDto>>> GetByCategoryAsync(Guid categoryGuid) =>
        await queryBusAsync.Dispatch<Result<List<CategoryPermissionDto>>, Guid>(categoryGuid);

    public async Task<Result<bool>> CheckAccessAsync(int categoryId, Guid positionGuid) =>
        await queryBusAsync.Dispatch<Result<bool>, CheckCategoryAccessDto>(
            new CheckCategoryAccessDto(categoryId, positionGuid));
}