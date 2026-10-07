using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Epc.Company.Query;
using Epc.Core;
using MeetingManagement.Infrastructure.Query.Contracts.Category;

namespace MeetingManagement.Presentation.Facade.Contracts.Category;

public interface ICategoryQueryFacade:IFacadeService
{
    Task<Result<List<CategoryJsonModel>>> List();
    Task<Result<CategoryJsonModel>> GetDetails(Guid guid);
    Task<Result<List<CategoryComboModel>>> GetForCombo();
    Task<Result<List<CategoryComboModel>>> GetForComboByCondition(CategoryComboSearchDto condition);
}