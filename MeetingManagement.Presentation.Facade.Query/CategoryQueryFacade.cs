using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Infrastructure.Query.Contracts.Category;
using MeetingManagement.Presentation.Facade.Contracts.Category;

namespace MeetingManagement.Presentation.Facade.Query;

public class CategoryQueryFacade(IQueryBusAsync queryBus) : ICategoryQueryFacade
{

    public async Task<Result<List<CategoryJsonModel>>> List()=> await queryBus.Dispatch<Result<List<CategoryJsonModel>>>();
    public async Task<Result<CategoryJsonModel>> GetDetails(Guid guid)=> await queryBus.Dispatch<Result<CategoryJsonModel>, Guid>(guid);
    public async Task<Result<List<CategoryComboModel>>> GetForCombo() => await queryBus.Dispatch<Result<List<CategoryComboModel>>>();
    public async Task<Result<List<CategoryComboModel>>> GetForComboByCondition(CategoryComboSearchDto condition)=> await queryBus.Dispatch<Result<List<CategoryComboModel>>, CategoryComboSearchDto>(condition);
}