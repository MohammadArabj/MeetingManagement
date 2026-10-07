using System.Collections.Generic;
using System.Threading.Tasks;
using Epc.Application.Command;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Assignment;
using MeetingManagement.Application.Contracts.Resolution;
using MeetingManagement.Presentation.Facade.Contracts.Resolution;

namespace MeetingManagement.Presentation.Facade.Command;

public class ResolutionCommandFacade(
    ICommandBusAsync commandBusAsync,
    IResponsiveCommandBusAsync responsiveCommandBusAsync)
    : IResolutionCommandFacade
{
    public async Task<Result<long>> CreateOrEdit(CreateResolutionDto command) =>
        await responsiveCommandBusAsync.Dispatch<CreateResolutionDto, Result<long>>(command);



    public async Task<Result<bool>> Delete(long id) =>
        await responsiveCommandBusAsync.Dispatch<DeleteResolutionDto, Result<bool>>(new DeleteResolutionDto { Id = id });


    public async Task<Result<bool>> Order(UpdateResolutionOrderRequest orders) =>
        await responsiveCommandBusAsync.Dispatch<UpdateResolutionOrderRequest, Result<bool>>(orders);

    public async Task<Result<long>> CreateOrEditBoardMeeting(CreateResolutionBoardMeetingDto command) =>
            await responsiveCommandBusAsync.Dispatch<CreateResolutionBoardMeetingDto, Result<long>>(command);
}