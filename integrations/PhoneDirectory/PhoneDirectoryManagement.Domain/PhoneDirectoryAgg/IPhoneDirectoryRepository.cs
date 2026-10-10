// PhoneDirectoryManagement.Domain/PhoneDirectoryAgg/IPhoneDirectoryRepository.cs
using Epc.Domain;

namespace PhoneDirectoryManagement.Domain.PhoneDirectoryAgg;

public interface IPhoneDirectoryRepository : IRepository<int, PhoneDirectoryEntry>
{
    bool ExistsWithPosition(Guid positionGuid, int? excludeId = null);
    bool ExistsWithLocationTitle(string locationTitle, int? excludeId = null);
}