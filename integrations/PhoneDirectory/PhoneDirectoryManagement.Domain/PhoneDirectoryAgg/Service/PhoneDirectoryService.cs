// PhoneDirectoryManagement.Domain/PhoneDirectoryAgg/Service/PhoneDirectoryService.cs
namespace PhoneDirectoryManagement.Domain.PhoneDirectoryAgg.Service;

public class PhoneDirectoryService(IPhoneDirectoryRepository repository) : IPhoneDirectoryService
{
    public void ThrowWhenDuplicatedPosition(Guid positionGuid, int? excludeId = null)
    {
        if (repository.ExistsWithPosition(positionGuid, excludeId))
            throw new InvalidOperationException("برای این سمت قبلاً یک مخاطب در دفترچه تلفن ثبت شده است.");
    }

    public void ThrowWhenDuplicatedLocation(string locationTitle, int? excludeId = null)
    {
        if (repository.ExistsWithLocationTitle(locationTitle, excludeId))
            throw new InvalidOperationException("مکانی با این عنوان قبلاً ثبت شده است.");
    }
}