// MeetingManagement.Presentation.Facade/Command/BlockedTimeCommandFacade.cs
using Epc.Application.Command;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.BlockedTime;
using MeetingManagement.Infrastructure.Query.Contracts.BlockedTime;
using MeetingManagement.Presentation.Facade.Contracts.BlockedTime;
using System;
using System.Threading.Tasks;

namespace MeetingManagement.Presentation.Facade.Command;

public class BlockedTimeCommandFacade(IResponsiveCommandBusAsync responsiveCommandBusAsync)
    : IBlockedTimeCommandFacade
{
    public async Task<Result<BlockedTimeJsonModel>> Create(CreateBlockedTimeDto command) =>
        await responsiveCommandBusAsync.Dispatch<CreateBlockedTimeDto, Result<BlockedTimeJsonModel>>(command);

    public async Task<Result<BlockedTimeJsonModel>> Update(UpdateBlockedTimeDto command) =>
        await responsiveCommandBusAsync.Dispatch<UpdateBlockedTimeDto, Result<BlockedTimeJsonModel>>(command);

    public async Task<Result<bool>> Delete(Guid guid) =>
        await responsiveCommandBusAsync.Dispatch<DeleteBlockedTimeDto, Result<bool>>(new DeleteBlockedTimeDto(guid));
}