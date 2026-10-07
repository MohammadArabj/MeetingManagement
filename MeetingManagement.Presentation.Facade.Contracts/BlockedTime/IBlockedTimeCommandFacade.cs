using Epc.Company.Query;
using Epc.Core;
using MeetingManagement.Application.Contracts.BlockedTime;
using MeetingManagement.Infrastructure.Query.Contracts.BlockedTime;
using System;
using System.Threading.Tasks;

namespace MeetingManagement.Presentation.Facade.Contracts.BlockedTime;

public interface IBlockedTimeCommandFacade:IFacadeService
{
    Task<Result<BlockedTimeJsonModel>> Create(CreateBlockedTimeDto command);
    Task<Result<BlockedTimeJsonModel>> Update(UpdateBlockedTimeDto command);
    Task<Result<bool>> Delete(Guid guid);
}