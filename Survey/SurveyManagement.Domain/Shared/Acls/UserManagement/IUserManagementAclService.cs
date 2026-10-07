using Epc.Core;

namespace SurveyManagement.Domain.Shared.Acls.UserManagement;

public interface IUserManagementAclService : IAclService
{
    Task<SystemViewHelper> GetSystemByAsync(string clientId);
    Task<UserViewHelper> GetUserByAsync(Guid guid);
    Task<List<UserViewHelper>> GetUsersByGuidsAsync(List<Guid?> userGuids);
    Task<List<UserPositionHelper>> GetUserAndPositionsByGuidsAsync(List<Guid?> userGuids);
    Task<List<UnitViewHelper>> GetUnitsByGuidsAsync(List<Guid?> unitGuids);
    Task<List<UnitViewHelper>> GetUnitsAsync();
    Task<UserDemographicViewHelper> GetUserDemographicsAsync(Guid userGuid);
}