using System;
using System.Threading.Tasks;
using Epc.Company.Query;
using Epc.Core;
using MeetingManagement.Application.Contracts.Label;

namespace MeetingManagement.Presentation.Facade.Contracts.Label;

public interface ILabelCommandFacade: IFacadeService
{
    Task<Result<Guid>> Create(CreateLabelDto command);
    Task<Result<bool>> Edit(EditLabelDto command);
    Task<Result<bool>> Delete(Guid guid);
    Task<Result<bool>> Activate(Guid guid);
    Task<Result<bool>> Deactivate(Guid guid);
}