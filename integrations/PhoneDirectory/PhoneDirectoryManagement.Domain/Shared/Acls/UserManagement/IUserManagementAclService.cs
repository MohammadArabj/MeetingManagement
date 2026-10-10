// PhoneDirectoryManagement.Domain/Shared/Acls/UserManagement/IUserManagementAclService.cs
namespace PhoneDirectoryManagement.Domain.Shared.Acls.UserManagement;


public interface IUserManagementAclService
{
    Task<List<UserPositionHelper>> GetUserAndPositionsByGuidsAsync(List<Guid?> userGuids);
    Task<List<PositionHelper>> GetPositionsByGuidsAsync(List<Guid?> positionGuids);
}