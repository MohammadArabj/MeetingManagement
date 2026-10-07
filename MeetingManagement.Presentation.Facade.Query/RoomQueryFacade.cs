using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Infrastructure.Query.Contracts.Room;
using MeetingManagement.Presentation.Facade.Contracts.Room;

namespace MeetingManagement.Presentation.Facade.Query;

public class RoomQueryFacade(IQueryBusAsync queryBus) : IRoomQueryFacade
{
    public async Task<Result<List<RoomJsonModel>>> List() => await queryBus.Dispatch<Result<List<RoomJsonModel>>>();
    public async Task<Result<RoomJsonModel>> GetDetails(Guid guid) => await queryBus.Dispatch<Result<RoomJsonModel>, Guid>(guid);
    public async Task<Result<List<RoomComboModel>>> GetForCombo() => await queryBus.Dispatch<Result<List<RoomComboModel>>>();
}