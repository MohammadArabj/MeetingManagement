using System;
using System.Threading.Tasks;
using Epc.Application.Command;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Role;
using MeetingManagement.Presentation.Facade.Contracts.Role;

namespace MeetingManagement.Presentation.Facade.Command;

public class RoleCommandFacade(IResponsiveCommandBusAsync responsiveCommandBusAsync,ICommandBusAsync commandBusAsync):IRoleCommandFacade
{
    public async Task<Result<Guid>> Create(CreateRoleDto command) =>
        await responsiveCommandBusAsync.Dispatch<CreateRoleDto, Result<Guid>>(command);

    public async Task<Result<bool>> Edit(EditRoleDto command) =>
        await responsiveCommandBusAsync.Dispatch<EditRoleDto, Result<bool>>(command);

}