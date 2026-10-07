using Epc.Domain;
using MeetingManagement.Domain.BlockedTimeAgg;

namespace MeetingManagement.Domain.UserBlockedTimeAgg;

public interface IBlockedTimeRepository : IRepository<long, BlockedTime>
{
    Task<bool> HasConflictAsync(Guid positionGuid, DateTime date, TimeSpan startTime, TimeSpan endTime, long? excludeId = null);
}