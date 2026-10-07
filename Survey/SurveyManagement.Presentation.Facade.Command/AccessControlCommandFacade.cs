
using Epc.Application.Command;
using Epc.Company.Query;
using SurveyManagement.Application.Contract.AccessControl;
using SurveyManagement.Application.Contracts.AccessControl;
using SurveyManagement.Presentation.Facade.Contract.SurveyAccess;

namespace SurveyManagement.Presentation.Facade.Command;

public class AccessControlCommandFacade : IAccessControlCommandFacade
{
    private readonly IResponsiveCommandBusAsync _commandBus;

    public AccessControlCommandFacade(IResponsiveCommandBusAsync commandBus)
    {
        _commandBus = commandBus;
    }

    public async Task<Result<bool>> SetSurveyAccess(SetSurveyAccessDto command) =>
        await _commandBus.Dispatch<SetSurveyAccessDto, Result<bool>>(command);

    public async Task<Result<bool>> RemoveSurveyAccess(RemoveSurveyAccessDto command) =>
        await _commandBus.Dispatch<RemoveSurveyAccessDto, Result<bool>>(command);

    public async Task<Result<bool>> AssignRoleToUser(AssignRoleToUserDto command) =>
        await _commandBus.Dispatch<AssignRoleToUserDto, Result<bool>>(command);

    public async Task<Result<bool>> RemoveRoleFromUser(RemoveRoleFromUserDto command) =>
        await _commandBus.Dispatch<RemoveRoleFromUserDto, Result<bool>>(command);

    public async Task<Result<int>> CreateRole(CreateRoleDto command) =>
        await _commandBus.Dispatch<CreateRoleDto, Result<int>>(command);

    public async Task<Result<bool>> EditRole(EditRoleDto command) =>
        await _commandBus.Dispatch<EditRoleDto, Result<bool>>(command);

    public async Task<Result<bool>> DeleteRole(DeleteRoleDto command) =>
        await _commandBus.Dispatch<DeleteRoleDto, Result<bool>>(command);
}
