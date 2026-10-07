using System;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.SettingAgg;
using MeetingManagement.Domain.Shared.Access;
using MeetingManagement.Domain.Shared.Notifications;
using MeetingManagement.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Quartz;

namespace MeetingManagement.Infrastructure.Configuration.Job;

/// <summary>
/// یادآوری‌های زمان‌بندی‌شده — هر ۱۰ دقیقه.
/// ─────────────────────────────────────────────────────────────────────────
/// برای جلوگیری از ارسال تکراری بدون افزودن ستون، از «Watermark» استفاده می‌شود:
/// آخرین زمان اجرای موفق در ردیف SystemSettings[NotificationReminderWatermark] ذخیره می‌شود و
/// هر اجرا فقط رویدادهایی را پردازش می‌کند که «زمان یادآوری»شان در بازه (watermark, now] باشد.
///   • یادآوری جلسه: شروع جلسه − MeetingReminderHoursBefore ساعت
///   • یادآوری سررسید تخصیص: ساعت ۸ صبح، AssignmentDueReminderDaysBefore روز قبل از مهلت
///   • تأخیر: ساعت ۸ صبح روز بعد از مهلت
/// </summary>
[DisallowConcurrentExecution]
public sealed class NotificationReminderJob(
    MeetingManagementCommandContext db,
    INotificationPublisher publisher,
    ILogger<NotificationReminderJob> logger) : IJob
{
    private static readonly TimeSpan DailyReminderTime = TimeSpan.FromHours(8);
    private static readonly TimeSpan MaxCatchUp = TimeSpan.FromDays(1);

    public async Task Execute(IJobExecutionContext context)
    {
        var ct = context.CancellationToken;
        var now = DateTime.Now;

        var watermarkRow = await db.SystemSettings.FirstOrDefaultAsync(s => s.Key == SettingKey.NotificationReminderWatermark, ct);
        if (watermarkRow is null)
        {
            // اولین اجرا: فقط Watermark ساخته می‌شود تا برای گذشته پیام انبوه ارسال نشود
            db.SystemSettings.Add(new SystemSetting(SettingValues.SystemGuid, SettingKey.NotificationReminderWatermark,
                now.ToString("O", CultureInfo.InvariantCulture), SettingValueType.String, SettingCategory.Notification,
                "آخرین زمان اجرای Job یادآوری", "داخلی - ویرایش نکنید", isPublic: false));
            await db.SaveChangesAsync(ct);
            return;
        }

        var from = DateTime.TryParse(watermarkRow.Value, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var w) ? w : now;
        if (now - from > MaxCatchUp) from = now - MaxCatchUp; // پس از قطعی طولانی، فقط ۲۴ ساعت اخیر

        var published = 0;
        published += await MeetingRemindersAsync(from, now, ct);
        published += await AssignmentRemindersAsync(from, now, ct);

        watermarkRow.UpdateValue(SettingValues.SystemGuid, now.ToString("O", CultureInfo.InvariantCulture));
        await db.SaveChangesAsync(ct);

        if (published > 0)
            logger.LogInformation("NotificationReminderJob published {Count} events in window {From}..{To}", published, from, now);
    }

    private async Task<int> MeetingRemindersAsync(DateTime from, DateTime to, CancellationToken ct)
    {
        var hours = SettingValues.MeetingReminderHoursBefore;
        if (hours <= 0) return 0;

        // بازه‌ی تاریخ جلسات کاندید (فیلتر دقیق ساعت در حافظه انجام می‌شود)
        var minDate = from.AddHours(hours).Date;
        var maxDate = to.AddHours(hours).Date;

        var candidates = await db.Meetings.AsNoTracking()
            .Where(m => m.IsRemoved != true
                        && (m.StatusId == MeetingStatusIds.Registered || m.StatusId == MeetingStatusIds.Draft)
                        && m.Date >= minDate && m.Date <= maxDate)
            .Select(m => new { m.Id, m.Date, m.StartTime })
            .ToListAsync(ct);

        var count = 0;
        foreach (var m in candidates)
        {
            var start = m.Date!.Value.Date + (m.StartTime ?? TimeSpan.Zero);
            var remindAt = start.AddHours(-hours);
            if (remindAt <= from || remindAt > to) continue;

            await publisher.PublishAsync(NotificationEventCode.MeetingReminder, new NotificationPayload { MeetingId = m.Id }, ct);
            count++;
        }
        return count;
    }

    private async Task<int> AssignmentRemindersAsync(DateTime from, DateTime to, CancellationToken ct)
    {
        var daysBefore = SettingValues.AssignmentDueReminderDaysBefore;
        var minDue = from.Date.AddDays(-1);
        var maxDue = to.Date.AddDays(Math.Max(daysBefore, 0));

        var assignments = await db.Assignments.AsNoTracking()
            .Where(a => a.ActionStatus != ActionStatus.End && a.DueDate != null && a.DueDate >= minDue && a.DueDate <= maxDue)
            .Select(a => new
            {
                a.Id, a.ResolutionId, a.DueDate, a.ActorGuid, a.ActorPositionGuid, a.FollowerGuid, a.FollowerPositionGuid,
                MeetingId = a.Resolution.MeetingId,
            })
            .ToListAsync(ct);

        var count = 0;
        foreach (var a in assignments)
        {
            var due = a.DueDate!.Value.Date;
            var dueText = Domain.AssignmentAgg.Assignment.ToShamsi(due);

            if (daysBefore > 0)
            {
                var remindAt = due.AddDays(-daysBefore) + DailyReminderTime;
                if (remindAt > from && remindAt <= to)
                {
                    await publisher.PublishAsync(NotificationEventCode.AssignmentDueReminder, Payload(a.MeetingId, a.ResolutionId, a.Id,
                        dueText, (NotificationRecipient.Actor, a.ActorGuid, a.ActorPositionGuid)), ct);
                    count++;
                }
            }

            var overdueAt = due.AddDays(1) + DailyReminderTime;
            if (overdueAt > from && overdueAt <= to)
            {
                await publisher.PublishAsync(NotificationEventCode.AssignmentOverdue, Payload(a.MeetingId, a.ResolutionId, a.Id, dueText,
                    (NotificationRecipient.Actor, a.ActorGuid, a.ActorPositionGuid),
                    (NotificationRecipient.Follower, a.FollowerGuid, a.FollowerPositionGuid)), ct);
                count++;
            }
        }
        return count;
    }

    private static NotificationPayload Payload(long meetingId, long resolutionId, int assignmentId, string due,
        params (NotificationRecipient As, Guid? User, Guid? Position)[] targets) => new()
    {
        MeetingId = meetingId,
        ResolutionId = resolutionId,
        AssignmentId = assignmentId,
        Targets = targets.Select(t => new NotificationTarget(t.As, t.User, t.Position)).ToList(),
        Values = { ["DueDate"] = due },
    };
}
