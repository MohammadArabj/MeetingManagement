// PhoneDirectoryManagement.Infrastructure/Persistence/Repository/PhoneDirectoryRepository.cs
using Epc.EntityFramework;
using Microsoft.EntityFrameworkCore;
using PhoneDirectoryManagement.Domain.PhoneDirectoryAgg;

namespace PhoneDirectoryManagement.Infrastructure.Persistence.Repository;

public class PhoneDirectoryRepository(DbContext commandContext)
    : BaseRepository<int, PhoneDirectoryEntry>(commandContext), IPhoneDirectoryRepository
{
    private readonly DbContext _ctx = commandContext;

    public bool ExistsWithPosition(Guid positionGuid, int? excludeId = null)
        => _ctx.Set<PhoneDirectoryEntry>()
               .Any(x => x.PositionGuid == positionGuid
                       && !x.IsRemoved
                       && (excludeId == null || x.Id != excludeId));

    public bool ExistsWithLocationTitle(string locationTitle, int? excludeId = null)
        => _ctx.Set<PhoneDirectoryEntry>()
               .Any(x => x.LocationTitle == locationTitle
                       && !x.IsRemoved
                       && (excludeId == null || x.Id != excludeId));
}