using System;
using System.Threading.Tasks;
using Epc.Company.Query;
using Epc.Core;
using MeetingManagement.Application.Contracts.Room;

namespace MeetingManagement.Presentation.Facade.Contracts.Room;

public interface IRoomCommandFacade:IFacadeService
{
    Task<Result<Guid>> Create(CreateRoomDto command);
    Task<Result<bool>> Edit(EditRoomDto command);
    Task<Result<bool>> Delete(Guid guid);
    Task<Result<bool>> Activate(Guid guid);
    Task<Result<bool>> Deactivate(Guid guid);
}