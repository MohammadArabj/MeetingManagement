using System;
using System.Threading.Tasks;
using Epc.Application.Command;
using Epc.Company.Query;
using Epc.Core.Events;
using MeetingManagement.Application.Contracts.Room;
using MeetingManagement.Presentation.Facade.Contracts.Room;

namespace MeetingManagement.Presentation.Facade.Command;

public class RoomCommandFacade(
    ICommandBusAsync commandBusAsync,
    IResponsiveCommandBusAsync responsiveCommandBusAsync,
    IEventAggregator eventAggregator)
    : IRoomCommandFacade
{
    private readonly IEventAggregator _eventAggregator = eventAggregator;

    public async Task<Result<Guid>> Create(CreateRoomDto command) =>
        await responsiveCommandBusAsync.Dispatch<CreateRoomDto, Result<Guid>>(command);

    public async Task<Result<bool>> Edit(EditRoomDto command) =>
        await responsiveCommandBusAsync.Dispatch<EditRoomDto, Result<bool>>(command);

    public async Task<Result<bool>> Delete(Guid guid) =>
        await responsiveCommandBusAsync.Dispatch<DeleteRoomDto, Result<bool>>(new DeleteRoomDto(guid));

    public async Task<Result<bool>> Activate(Guid guid) =>
        await responsiveCommandBusAsync.Dispatch<ActivateRoomDto, Result<bool>>(new ActivateRoomDto(guid));

    public async Task<Result<bool>> Deactivate(Guid guid) =>
        await responsiveCommandBusAsync.Dispatch<DeactivateRoomDto, Result<bool>>(new DeactivateRoomDto(guid));

}