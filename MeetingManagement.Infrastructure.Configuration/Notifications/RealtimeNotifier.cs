using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MeetingManagement.Domain.Shared.Notifications;
using Microsoft.Extensions.Logging;

namespace MeetingManagement.Infrastructure.Configuration.Notifications;

/// <summary>
/// پیاده‌سازی Scoped صف اعلان لحظه‌ای. خطای ارسال هرگز عملیات کاربر را خراب نمی‌کند.
/// </summary>
public sealed class RealtimeNotifier(IRealtimeBroadcaster broadcaster, ILogger<RealtimeNotifier> logger) : IRealtimeNotifier
{
    private readonly List<RealtimeMessage> _pending = [];
    private readonly Lock _sync = new();

    public void Enqueue(RealtimeMessage message)
    {
        if (message.UserGuids.Count == 0 && message.PositionGuids.Count == 0) return;
        lock (_sync) _pending.Add(message);
    }

    public async Task FlushAsync(CancellationToken ct = default)
    {
        RealtimeMessage[] batch;
        lock (_sync)
        {
            if (_pending.Count == 0) return;
            batch = _pending.ToArray();
            _pending.Clear();
        }

        try
        {
            await broadcaster.BroadcastAsync(batch, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Realtime broadcast of {Count} messages failed", batch.Length);
        }
    }

    public void Discard()
    {
        lock (_sync) _pending.Clear();
    }
}
