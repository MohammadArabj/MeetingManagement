using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.Shared.Notifications;
using MeetingManagement.Domain.MeetingAgg;
using MeetingManagement.Domain.SettingAgg;
using MeetingManagement.Domain.Shared.Access;
using Microsoft.Extensions.Logging;
using Quartz;
using System;
using System.Threading.Tasks;

namespace MeetingManagement.Infrastructure.Configuration.Job;

/// <summary>
/// اتمام خودکار جلسات «ثبت نهایی» که از امضای رئیس آن‌ها بیش از MeetingAutoCloseMinutes گذشته است.
/// امضای رئیس تنها شرط است؛ سایر اعضا تا آن زمان فرصت امضا دارند.
/// اجرا: هر ۳۰ دقیقه
/// </summary>
[DisallowConcurrentExecution] // ✅ جایگزین LockTimer
[PersistJobDataAfterExecution]
public class MeetingAutoCloseJob : IJob
{
    private readonly IMeetingRepository _meetingRepository;
    private readonly INotificationPublisher _publisher;
    private readonly IRealtimeNotifier _realtime;
    private readonly ILogger<MeetingAutoCloseJob> _logger;

    public MeetingAutoCloseJob(
        IMeetingRepository meetingRepository,
        INotificationPublisher publisher,
        IRealtimeNotifier realtime,
        ILogger<MeetingAutoCloseJob> logger)
    {
        _meetingRepository = meetingRepository;
        _publisher = publisher;
        _realtime = realtime;
        _logger = logger;
    }

    public async Task Execute(IJobExecutionContext context)
    {
        var startTime = DateTime.Now;

        try
        {

            // ✅ خواندن تنظیم از Static Cache
            var autoCloseMinutes = SettingValues.MeetingAutoCloseMinutes;

            if (autoCloseMinutes <= 0)//زمانبندی غیر فعال است
            {
                return;
            }

            var cutoffTime = DateTime.Now.AddMinutes(-autoCloseMinutes);

            // ✅ دریافت جلسات واجد شرایط
            var meetings = await _meetingRepository.GetMeetingsReadyForAutoClose(cutoffTime);

            if (meetings == null || meetings.Count == 0)
            {
                return;
            }


            var closedCount = 0;
            var failedCount = 0;
            var systemGuid = SettingValues.SystemGuid;

            foreach (var meeting in meetings)
            {
                try
                {
                    meeting.ChangeStatus(systemGuid, MeetingStatusIds.Completed);
                    _meetingRepository.Update(meeting);
                    await _publisher.PublishAsync(NotificationEventCode.MeetingFinalized, new NotificationPayload { MeetingId = meeting.Id });
                    closedCount++;

                    _logger.LogInformation("Meeting {MeetingId} ({Number}) auto-closed", meeting.Id, meeting.Number);
                }
                catch (Exception ex)
                {
                    failedCount++;
                    _logger.LogError(ex, "Failed to auto-close meeting {MeetingId}", meeting.Id);
                }
            }

            // ذخیره تغییرات و سپس ارسال اعلان‌های لحظه‌ای
            await _meetingRepository.SaveChangesAsync();
            await _realtime.FlushAsync(context.CancellationToken);
            _logger.LogInformation("MeetingAutoCloseJob closed {Closed} meetings ({Failed} failed)", closedCount, failedCount);


        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MeetingAutoCloseJob failed");

            throw; // Quartz می‌تواند retry کند
        }
    }

}