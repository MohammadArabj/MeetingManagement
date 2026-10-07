using System.Threading.Tasks;
using Epc.Company.Query;
using Epc.Core;
using MeetingManagement.Application.Contracts.Action;
using MeetingManagement.Infrastructure.Query.Contracts.Action;

namespace MeetingManagement.Presentation.Facade.Contracts.Action;

public interface IActionCommandFacade:IFacadeService
{
    Task<Result<bool>> CreateOrEdit(ActionDto command);
    Task<Result<bool>> Delete(long id);
    Task<Result<bool>> ReviewAction(ReviewActionDto reviewAction);
    Task<Result<bool>> ChangeStatus(AssignmentChangeStatusDto command);
}