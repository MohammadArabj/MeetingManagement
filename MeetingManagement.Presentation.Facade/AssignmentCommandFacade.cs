using System.Threading.Tasks;
using Epc.Application.Command;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Assignment;
using MeetingManagement.Presentation.Facade.Contracts.Assignment;

namespace MeetingManagement.Presentation.Facade.Command;

public class AssignmentCommandFacade(IResponsiveCommandBusAsync responsiveCommandBusAsync) : IAssignmentCommandFacade
{
    public async Task<Result<bool>> CreateOrEdit(AssignmentDto command) =>
        await responsiveCommandBusAsync.Dispatch<AssignmentDto, Result<bool>>(command);

    public async Task<Result<bool>> CreateReferral(AssignmentReferralDto command) =>
        await responsiveCommandBusAsync.Dispatch<AssignmentReferralDto, Result<bool>>(command);

    public async Task<Result<bool>> Delete(int id) => await responsiveCommandBusAsync.Dispatch<DeleteAssignmentDto, Result<bool>>(new DeleteAssignmentDto(id));
    public async Task<Result<bool>> ReturnReferral(ReturnReferralDto command) =>
        await responsiveCommandBusAsync.Dispatch<ReturnReferralDto, Result<bool>>(command);

    public async Task<Result<bool>> RecallReferral(RecallReferralDto command) =>
        await responsiveCommandBusAsync.Dispatch<RecallReferralDto, Result<bool>>(command);

    public async Task<Result<bool>> ChangeResult(ChangeAssignmentResultDto result)=>await responsiveCommandBusAsync.Dispatch<ChangeAssignmentResultDto, Result<bool>>(result);
}