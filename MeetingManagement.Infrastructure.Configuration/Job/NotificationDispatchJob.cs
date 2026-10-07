using MeetingManagement.Domain.SettingAgg;
using MeetingManagement.Infrastructure.Configuration.Notifications;
using MeetingManagement.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Quartz;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace MeetingManagement.Infrastructure.Configuration.Job;

/// <summary>
/// ارسال صف پیامک (Outbox) — هر دقیقه.
/// وضعیت‌ها در ستون Status: pending → sent | retry:N → failed ؛ SentAt = زمان تلاش بعدی/زمان ارسال.
/// تلاش مجدد با فاصله نمایی (۲، ۴، ۸، ... دقیقه) تا سقف NotificationMaxRetry.
/// </summary>
[DisallowConcurrentExecution]
public sealed class NotificationDispatchJob(
    MeetingManagementCommandContext db,
    ISmsSender smsSender,
    ILogger<NotificationDispatchJob> logger) : IJob
{
    private const int BatchSize = 100;

    public async Task Execute(IJobExecutionContext context)
    {
        if (!SettingValues.SmsEnabled) return;

        var now = DateTime.Now;
        if (SettingValues.IsInQuietHours(now)) return;

        var batch = await db.NotificationLogs
            .Where(l => l.Receiver.StartsWith(NotificationPublisher.SmsPrefix)
                        && (l.Status == NotificationPublisher.StatusPending || l.Status.StartsWith(NotificationPublisher.RetryPrefix))
                        && l.SentAt <= now)
            .OrderBy(l => l.SentAt)
            .Take(BatchSize)
            .ToListAsync(context.CancellationToken);

        if (batch.Count == 0) return;

        var sent = 0;
        foreach (var log in batch)
        {
            var mobile = log.Receiver[NotificationPublisher.SmsPrefix.Length..];
            var result = await smsSender.SendAsync(mobile, log.Message, context.CancellationToken);

            if (result.Success)
            {
                log.Status = NotificationPublisher.StatusSent;
                log.SentAt = DateTime.Now;
                log.ErrorMessage = null;
                sent++;
                continue;
            }

            var attempts = ParseAttempts(log.Status) + 1;
            log.ErrorMessage = result.Error?.Length > 3000 ? result.Error[..3000] : result.Error;

            if (attempts > SettingValues.NotificationMaxRetry)
            {
                log.Status = NotificationPublisher.StatusFailed;
            }
            else
            {
                log.Status = $"{NotificationPublisher.RetryPrefix}{attempts}";
                log.SentAt = DateTime.Now.AddMinutes(Math.Pow(2, attempts));
            }
        }

        await db.SaveChangesAsync(context.CancellationToken);
        logger.LogInformation("NotificationDispatchJob: {Sent}/{Total} SMS sent", sent, batch.Count);
    }

    public static int ParseAttempts(string? status) =>
        status is not null && status.StartsWith(NotificationPublisher.RetryPrefix)
        && int.TryParse(status[NotificationPublisher.RetryPrefix.Length..], out var n) ? n : 0;
}
