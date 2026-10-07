using System.Collections.Generic;
using System.Threading.Tasks;
using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Infrastructure.Query.Contracts.Action;
using MeetingManagement.Presentation.Facade.Contracts.Action;

namespace MeetingManagement.Presentation.Facade.Query;

public class ActionQueryFacade(IQueryBusAsync queryBusAsync):IActionQueryFacade
{
    public async Task<Result<List<ActionListDto>>> GetList(int id) =>
        await queryBusAsync.Dispatch<Result<List<ActionListDto>>, int>(id);
}