using Epc.EntityFramework;
using MeetingManagement.Domain.ResolutionAgg;
using Microsoft.EntityFrameworkCore;

namespace MeetingManagement.Infrastructure.Persistence.Repository;

public class ResolutionRepository(DbContext commandContext)
    : BaseRepository<long, Resolution>(commandContext), IResolutionRepository
{
    public Task<Resolution?> LoadForEditAsync(long id, CancellationToken ct = default) =>
        commandContext.Set<Resolution>()
            .Include(r => r.Meeting)
            .Include(r => r.AssignedMembers).ThenInclude(a => a.Actions)
            .Include(r => r.AssignedMembers).ThenInclude(a => a.ReferredAssignments)
            .AsSplitQuery()
            .FirstOrDefaultAsync(r => r.Id == id, ct);

    public async Task<(List<byte?> SortOrders, List<string?> Numbers)> GetOrderingAsync(
        long meetingId, long? exceptResolutionId = null, CancellationToken ct = default)
    {
        var rows = await commandContext.Set<Resolution>()
            .AsNoTracking()
            .Where(r => r.MeetingId == meetingId && (exceptResolutionId == null || r.Id != exceptResolutionId))
            .Select(r => new { r.SortOrder, r.Number })
            .ToListAsync(ct);

        return (rows.Select(r => r.SortOrder).ToList(), rows.Select(r => r.Number).ToList());
    }

    public async Task<T> InTransactionAsync<T>(Func<Task<T>> action, CancellationToken ct = default)
    {
        if (commandContext.Database.CurrentTransaction is not null)
            return await action();

        var strategy = commandContext.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await commandContext.Database.BeginTransactionAsync(ct);
            var result = await action();
            await commandContext.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return result;
        });
    }
}
