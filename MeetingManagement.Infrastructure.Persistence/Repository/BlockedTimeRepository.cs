using Epc.EntityFramework;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.BlockedTimeAgg;
using MeetingManagement.Domain.UserBlockedTimeAgg;
using Microsoft.EntityFrameworkCore;

namespace MeetingManagement.Infrastructure.Persistence.Repository;

public class BlockedTimeRepository(DbContext commandContext)
    : BaseRepository<long, BlockedTime>(commandContext), IBlockedTimeRepository
{
    public async Task<bool> HasConflictAsync(
       Guid positionGuid,
       DateTime date,
       TimeSpan startTime,
       TimeSpan endTime,
       long? excludeId = null)
    {
        return await commandContext.Set<BlockedTime>()
            .Where(b => b.UserGuid == positionGuid)
            .Where(b => b.Date.Date == date.Date)
            .Where(b => !b.IsRemoved)
            .WhereIf(excludeId.HasValue, b => b.Id != excludeId.Value)
            .AnyAsync(b => startTime < b.EndTime && endTime > b.StartTime);
    }
}