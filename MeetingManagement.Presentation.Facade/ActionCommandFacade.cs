using System.Threading.Tasks;
using Epc.Application.Command;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Action;
using MeetingManagement.Infrastructure.Query.Contracts.Action;
using MeetingManagement.Presentation.Facade.Contracts.Action;

namespace MeetingManagement.Presentation.Facade.Command;

public class ActionCommandFacade(IResponsiveCommandBusAsync responsiveCommandBusAsync):IActionCommandFacade
{
    public async Task<Result<bool>> CreateOrEdit(ActionDto command) =>
        await responsiveCommandBusAsync.Dispatch<ActionDto, Result<bool>>(command);

    public async Task<Result<bool>> Delete(long id) =>
        await responsiveCommandBusAsync.Dispatch<DeleteActionDto, Result<bool>>(new DeleteActionDto(id));

    public async Task<Result<bool>> ReviewAction(ReviewActionDto reviewAction) =>
        await responsiveCommandBusAsync.Dispatch<ReviewActionDto, Result<bool>>(reviewAction);

    public async Task<Result<bool>> ChangeStatus(AssignmentChangeStatusDto command) =>
        await responsiveCommandBusAsync.Dispatch<AssignmentChangeStatusDto, Result<bool>>(command);
}