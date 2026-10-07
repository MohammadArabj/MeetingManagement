using Epc.Company.Query;
using SurveyManagement.Application.Contract.AccessControl;
using SurveyManagement.Application.Contracts.AccessControl;

namespace SurveyManagement.Presentation.Facade.Contract.SurveyAccess;

/// <summary>
/// Facade برای Command های AccessControl
/// </summary>
public interface IAccessControlCommandFacade
{
    Task<Result<bool>> SetSurveyAccess(SetSurveyAccessDto command);
    Task<Result<bool>> RemoveSurveyAccess(RemoveSurveyAccessDto command);
    Task<Result<bool>> AssignRoleToUser(AssignRoleToUserDto command);
    Task<Result<bool>> RemoveRoleFromUser(RemoveRoleFromUserDto command);
    Task<Result<int>> CreateRole(CreateRoleDto command);
    Task<Result<bool>> EditRole(EditRoleDto command);
    Task<Result<bool>> DeleteRole(DeleteRoleDto command);
}
