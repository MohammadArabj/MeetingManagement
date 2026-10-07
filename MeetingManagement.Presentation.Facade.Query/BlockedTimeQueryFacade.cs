// MeetingManagement.Presentation.Facade/Query/BlockedTimeQueryFacade.cs
using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Infrastructure.Query.Contracts.BlockedTime;
using MeetingManagement.Infrastructure.Query.Contracts.UserBlockedTime;
using MeetingManagement.Presentation.Facade.Contracts.BlockedTime;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace MeetingManagement.Presentation.Facade.Query;

public class BlockedTimeQueryFacade(IQueryBusAsync queryBus) : IBlockedTimeQueryFacade
{
    public async Task<Result<List<BlockedTimeJsonModel>>> GetList(Guid positionGuid) =>
        await queryBus.Dispatch<Result<List<BlockedTimeJsonModel>>, Guid>(positionGuid);

    public async Task<Result<List<BlockedTimeJsonModel>>> GetForCalendar(BlockedTimeCalendarSearchDto condition) =>
        await queryBus.Dispatch<Result<List<BlockedTimeJsonModel>>, BlockedTimeCalendarSearchDto>(condition);

    public async Task<Result<AvailabilityResultModel>> CheckAvailability(CheckAvailabilityDto condition) =>
        await queryBus.Dispatch<Result<AvailabilityResultModel>, CheckAvailabilityDto>(condition);

    public async Task<Result<MultipleAvailabilityResultModel>> CheckMultipleAvailability(CheckMultipleAvailabilityDto condition) =>
        await queryBus.Dispatch<Result<MultipleAvailabilityResultModel>, CheckMultipleAvailabilityDto>(condition);
}