using Epc.EntityFramework;
using MeetingManagement.Domain.AssignmentAgg;
using Microsoft.EntityFrameworkCore;

namespace MeetingManagement.Infrastructure.Persistence.Repository;

public class AssignmentRepository(DbContext commandContext)
    : BaseRepository<int, Assignment>(commandContext), IAssignmentRepository
{
    public Task<List<Assignment>> GetResolutionTreeAsync(long resolutionId, CancellationToken ct = default) =>
        commandContext.Set<Assignment>()
            .Include(a => a.Actions)
            .Where(a => a.ResolutionId == resolutionId)
            .ToListAsync(ct);

    public Task<Assignment?> LoadWithChildrenAsync(int id, CancellationToken ct = default) =>
        commandContext.Set<Assignment>()
            .Include(a => a.Actions)
            .Include(a => a.ReferredAssignments)
            .FirstOrDefaultAsync(a => a.Id == id, ct);

    public Task<List<Assignment>> GetOriginalsByMeetingAsync(long meetingId, CancellationToken ct = default) =>
        commandContext.Set<Assignment>()
            .AsNoTracking()
            .Where(a => !a.IsReferral && a.Resolution.MeetingId == meetingId)
            .ToListAsync(ct);
}
