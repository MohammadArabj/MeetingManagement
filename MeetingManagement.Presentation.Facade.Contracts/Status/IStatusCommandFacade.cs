using Epc.Core;
using System.Threading.Tasks;
using System;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Status;

namespace MeetingManagement.Presentation.Facade.Contracts.Status;

public interface IStatusCommandFacade:IFacadeService
{
    Task<Result<Guid>> Create(CreateStatusDto command);
    Task<Result<bool>> Edit(EditStatusDto command);
}