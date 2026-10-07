using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Epc.Company.Query;
using Epc.Core;
using MeetingManagement.Infrastructure.Query.Contracts.Room;

namespace MeetingManagement.Presentation.Facade.Contracts.Room;

public interface IRoomQueryFacade:IFacadeService
{
    Task<Result<List<RoomJsonModel>>> List();
    Task<Result<RoomJsonModel>> GetDetails(Guid guid);
    Task<Result<List<RoomComboModel>>> GetForCombo();
}