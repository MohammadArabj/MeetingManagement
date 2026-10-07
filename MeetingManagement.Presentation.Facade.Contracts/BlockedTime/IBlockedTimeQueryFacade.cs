// MeetingManagement.Presentation.Facade.Contracts/BlockedTime/IBlockedTimeQueryFacade.cs
using Epc.Company.Query;
using Epc.Core;
using MeetingManagement.Infrastructure.Query.Contracts.BlockedTime;
using MeetingManagement.Infrastructure.Query.Contracts.UserBlockedTime;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace MeetingManagement.Presentation.Facade.Contracts.BlockedTime;

public interface IBlockedTimeQueryFacade:IFacadeService
{
    Task<Result<List<BlockedTimeJsonModel>>> GetList(Guid positionGuid);
    Task<Result<List<BlockedTimeJsonModel>>> GetForCalendar(BlockedTimeCalendarSearchDto condition);
    Task<Result<AvailabilityResultModel>> CheckAvailability(CheckAvailabilityDto condition);
    Task<Result<MultipleAvailabilityResultModel>> CheckMultipleAvailability(CheckMultipleAvailabilityDto condition);
}