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
/// • اتمام خودکار جلسات «ثبت نهایی» که از امضای رئیس آن‌ها بیش از MeetingAutoCloseMinutes گذشته است
///   (امضای رئیس تنها شرط است؛ سایر اعضا تا آن زمان فرصت امضا دارند).
/// • «تعیین تکلیف نشده» کردن جلسات معوق (در صورت فعال بودن MeetingUndeterminedAfterDays).
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
        try
        {
            var changed = await AutoCloseAsync();
            changed |= await MarkUndeterminedAsync();

            if (changed)
            {
                // ذخیره تغییرات و سپس ارسال اعلان‌های لحظه‌ای
                await _meetingRepository.SaveChangesAsync();
                await _realtime.FlushAsync(context.CancellationToken);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MeetingAutoCloseJob failed");
            throw; // Quartz می‌تواند retry کند
        }
    }

    /// <summary>اتمام جلسات «ثبت نهایی» که از امضای رئیس آن‌ها بیش از مدت تنظیم‌شده گذشته است</summary>
    private async Task<bool> AutoCloseAsync()
    {
        var autoCloseMinutes = SettingValues.MeetingAutoCloseMinutes;
        if (autoCloseMinutes <= 0) return false; // زمان‌بندی غیرفعال است

        var meetings = await _meetingRepository.GetMeetingsReadyForAutoClose(DateTime.Now.AddMinutes(-autoCloseMinutes));
        if (meetings.Count == 0) return false;

        var systemGuid = SettingValues.SystemGuid;
        var closed = 0;
        foreach (var meeting in meetings)
        {
            try
            {
                meeting.ChangeStatus(systemGuid, MeetingStatusIds.Completed);
                _meetingRepository.Update(meeting);
                await _publisher.PublishAsync(NotificationEventCode.MeetingFinalized, new NotificationPayload { MeetingId = meeting.Id });
                closed++;
                _logger.LogInformation("Meeting {MeetingId} ({Number}) auto-closed", meeting.Id, meeting.Number);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to auto-close meeting {MeetingId}", meeting.Id);
            }
        }

        _logger.LogInformation("MeetingAutoCloseJob closed {Closed} of {Total} meetings", closed, meetings.Count);
        return closed > 0;
    }

    /// <summary>
    /// جلسات «ثبت اولیه/برگزار شده» که MeetingUndeterminedAfterDays روز از تاریخشان گذشته و نهایی نشده‌اند ← «تعیین تکلیف نشده».
    /// از این وضعیت می‌توان جلسه را برگزار یا لغو کرد.
    /// </summary>
    private async Task<bool> MarkUndeterminedAsync()
    {
        var afterDays = SettingValues.MeetingUndeterminedAfterDays;
        if (afterDays <= 0) return false;

        var meetings = await _meetingRepository.GetStaleOpenMeetings(DateTime.Today.AddDays(-afterDays));
        if (meetings.Count == 0) return false;

        var systemGuid = SettingValues.SystemGuid;
        foreach (var meeting in meetings)
        {
            meeting.ChangeStatus(systemGuid, MeetingStatusIds.Undetermined);
            _meetingRepository.Update(meeting);
        }

        _logger.LogInformation("MeetingAutoCloseJob marked {Count} meetings as undetermined", meetings.Count);
        return true;
    }
}