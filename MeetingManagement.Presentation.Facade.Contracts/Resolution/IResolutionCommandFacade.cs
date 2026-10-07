using System.Collections.Generic;
using Epc.Core;
using System.Threading.Tasks;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Resolution;
using MeetingManagement.Application.Contracts.Assignment;

namespace MeetingManagement.Presentation.Facade.Contracts.Resolution;

public interface IResolutionCommandFacade:IFacadeService
{
    Task<Result<long>> CreateOrEdit(CreateResolutionDto command);
    Task<Result<bool>> Delete(long id);

    Task<Result<bool>> Order(UpdateResolutionOrderRequest orders);
    Task<Result<long>> CreateOrEditBoardMeeting(CreateResolutionBoardMeetingDto command);
}