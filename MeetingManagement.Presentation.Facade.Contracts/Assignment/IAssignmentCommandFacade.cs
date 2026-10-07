using System.Threading.Tasks;
using Epc.Company.Query;
using Epc.Core;
using MeetingManagement.Application.Contracts.Assignment;

namespace MeetingManagement.Presentation.Facade.Contracts.Assignment;

public interface IAssignmentCommandFacade : IFacadeService
{
    Task<Result<bool>> CreateOrEdit(AssignmentDto command);
    Task<Result<bool>> CreateReferral(AssignmentReferralDto command);
    Task<Result<bool>> Delete(int id);
    Task<Result<bool>> ReturnReferral(ReturnReferralDto command);
    Task<Result<bool>> RecallReferral(RecallReferralDto command);
    Task<Result<bool>> ChangeResult(ChangeAssignmentResultDto result);
}