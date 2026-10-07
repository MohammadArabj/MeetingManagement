using Epc.Core;

namespace MeetingManagement.Domain.RoleAgg.Service;

public interface IRoleService : IDomainService
{
    Task ThrowWhenDuplicated(string title, int? id = null);

}