using System;
using System.Threading.Tasks;
using Epc.Company.Query;
using Epc.Core;
using MeetingManagement.Application.Contracts.Role;

namespace MeetingManagement.Presentation.Facade.Contracts.Role;

public interface IRoleCommandFacade: IFacadeService
{
    Task<Result<Guid>> Create(CreateRoleDto command);
    Task<Result<bool>> Edit(EditRoleDto command);
}