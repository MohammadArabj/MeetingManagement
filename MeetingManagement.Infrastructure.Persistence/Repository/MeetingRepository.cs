using Epc.EntityFramework;
using MeetingManagement.Domain.MeetingAgg;
using MeetingManagement.Domain.Shared.Access;
using Microsoft.EntityFrameworkCore;

namespace MeetingManagement.Infrastructure.Persistence.Repository;

public class MeetingRepository(DbContext commandContext)
    : BaseRepository<long, Meeting>(commandContext), IMeetingRepository
{
    /// <summary>
    /// جلسات «ثبت نهایی» که رئیس آن‌ها را امضا کرده و از زمان امضای رئیس بیش از مدت تنظیم‌شده گذشته است.
    /// امضای رئیس تنها امضای تعیین‌کننده است؛ امضای دبیر (و دبیر غیرعضو) شرط اتمام نیست.
    /// </summary>
    public async Task<List<Meeting>> GetMeetingsReadyForAutoClose(DateTime cutoffTime)
    {
        var chairmanId = MeetingRoles.ChairmanId;

        return await commandContext.Set<Meeting>()
            .Where(meeting => meeting.StatusId == MeetingStatusIds.Finalized
                              && meeting.IsRemoved != true
                              && meeting.IsActive == 1
                              && meeting.MeetingMembers.Any(m => m.RoleId == chairmanId
                                                                 && m.IsSign == true
                                                                 && m.SignedAt != null
                                                                 && m.SignedAt <= cutoffTime))
            .ToListAsync();
    }
}
