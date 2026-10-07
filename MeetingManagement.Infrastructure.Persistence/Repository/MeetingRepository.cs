using Epc.EntityFramework;
using MeetingManagement.Domain.MeetingAgg;
using MeetingManagement.Domain.Shared.Access;
using Microsoft.EntityFrameworkCore;

namespace MeetingManagement.Infrastructure.Persistence.Repository;

public class MeetingRepository(DbContext commandContext)
    : BaseRepository<long, Meeting>(commandContext), IMeetingRepository
{
    /// <summary>
    /// جلسات «امضاشده» که رئیس و دبیر (دبیر یا دبیر غیرعضو) امضا کرده‌اند و آخرین امضا قبل از cutoff است.
    /// شناسه نقش‌ها از <see cref="MeetingRoles"/> خوانده می‌شود (نه عدد ثابت).
    /// </summary>
    public async Task<List<Meeting>> GetMeetingsReadyForAutoClose(DateTime cutoffTime)
    {
        var chairmanId = MeetingRoles.ChairmanId;
        var secretaryId = MeetingRoles.SecretaryId;
        var nonMemberSecretaryId = MeetingRoles.NonMemberSecretaryId;
        const int statusSigned = MeetingStatusIds.Signed;

        var query = from meeting in commandContext.Set<Meeting>()
                    where meeting.StatusId == statusSigned
                          && meeting.IsRemoved != true
                          && meeting.IsActive == 1
                          && meeting.MeetingMembers.Any(m => m.RoleId == chairmanId && m.IsSign == true && m.SignedAt != null)
                          && meeting.MeetingMembers.Any(m => (m.RoleId == secretaryId || m.RoleId == nonMemberSecretaryId)
                                                             && m.IsSign == true && m.SignedAt != null)
                    let lastSignedAt = meeting.MeetingMembers
                        .Where(m => m.IsSign == true && m.SignedAt != null &&
                                    (m.RoleId == chairmanId || m.RoleId == secretaryId || m.RoleId == nonMemberSecretaryId))
                        .Max(m => m.SignedAt)
                    where lastSignedAt != null && lastSignedAt <= cutoffTime
                    select meeting;

        return await query.ToListAsync();
    }
}
