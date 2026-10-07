using Epc.Application.Command;
using Epc.Identity;
using Epc.Core.Events;
using MeetingManagement.Application.Contracts.Room;
using MeetingManagement.Domain.RoomAgg;
using MeetingManagement.Domain.RoomAgg.Service;
using Epc.Company.Query;

namespace MeetingManagement.Application;

public class RoomCommandHandler(
    IRoomRepository repository,
    IClaimHelper claimHelper,
    IEventAggregator eventAggregator,
    IRoomService service
) : ICommandHandlerAsync<CreateRoomDto, Result<Guid>>,
    ICommandHandlerAsync<EditRoomDto, Result<bool>>,
    ICommandHandlerAsync<DeleteRoomDto, Result<bool>>,
    ICommandHandlerAsync<ActivateRoomDto, Result<bool>>,
    ICommandHandlerAsync<DeactivateRoomDto, Result<bool>>
{
    private readonly IEventAggregator _eventAggregator = eventAggregator;

    public async Task<Result<Guid>> Handle(CreateRoomDto command)
    {
        var creator = claimHelper.GetCurrentUserGuid();
        var room = new Room(creator, command.Title, command.Capacity, service, command.Address);
        await repository.CreateAsync(room);
        return Result<Guid>.Success(room.Guid);
    }

    public async Task<Result<bool>> Handle(EditRoomDto command)
    {
        var actor = claimHelper.GetCurrentUserGuid();
        var room = await repository.LoadAsync(command.Guid);
        if (room == null)
            return Result<bool>.Failure(false, "اتاق مورد نظر یافت نشد.");

        room.Edit(actor, command.Title, command.Capacity, service, command.Address);
        repository.Update(room);
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> Handle(DeleteRoomDto command)
    {
        var room = await repository.LoadAsync(command.Guid);
        if (room == null)
            return Result<bool>.Failure(false, "اتاق مورد نظر یافت نشد.");
        if (await service.HasHistoryAsync(room.Id))
            return Result<bool>.Failure(false, "به دلیل وجود سابقه امکان حذف وجود ندارد");
        repository.Delete(room);
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> Handle(ActivateRoomDto command)
    {
        var room = await repository.LoadAsync(command.Guid);
        if (room == null)
            return Result<bool>.Failure(false, "اتاق مورد نظر یافت نشد.");

        room.Activate();
        repository.Update(room);
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> Handle(DeactivateRoomDto command)
    {
        var room = await repository.LoadAsync(command.Guid);
        if (room == null)
            return Result<bool>.Failure(false, "اتاق مورد نظر یافت نشد.");

        room.Deactivate();
        repository.Update(room);
        return Result<bool>.Success(true);
    }
}

