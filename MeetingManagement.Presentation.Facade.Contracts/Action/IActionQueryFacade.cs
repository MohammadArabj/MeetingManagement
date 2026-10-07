using System.Collections.Generic;
using System.Threading.Tasks;
using Epc.Company.Query;
using Epc.Core;
using MeetingManagement.Infrastructure.Query.Contracts.Action;

namespace MeetingManagement.Presentation.Facade.Contracts.Action;

public interface IActionQueryFacade:IFacadeService
{
    Task<Result<List<ActionListDto>>> GetList(int id);
}