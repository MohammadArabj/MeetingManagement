// PhoneDirectoryManagement.Domain/PhoneDirectoryAgg/Service/IPhoneDirectoryService.cs
namespace PhoneDirectoryManagement.Domain.PhoneDirectoryAgg.Service;

public interface IPhoneDirectoryService
{
    void ThrowWhenDuplicatedPosition(Guid positionGuid, int? excludeId = null);
    void ThrowWhenDuplicatedLocation(string locationTitle, int? excludeId = null);
}
