using MeetingManagement.Domain.MeetingAgg;
using MeetingManagement.Domain.SettingAgg;
using MeetingManagement.Domain.Shared.Access;
using Microsoft.Extensions.Logging;
using Quartz;
using System;
using System.Threading.Tasks;

namespace MeetingManagement.Infrastructure.Configuration.Job;

/// <summary>
/// جاب اتمام خودکار جلسات پس از امضای رئیس و دبیر
/// اجرا: هر شب ساعت 2:00
/// </summary>
[DisallowConcurrentExecution] // ✅ جایگزین LockTimer
[PersistJobDataAfterExecution]
public class MeetingAutoCloseJob : IJob
{
    private readonly IMeetingRepository _meetingRepository;
    private readonly ILogger<MeetingAutoCloseJob> _logger;


    public MeetingAutoCloseJob(
        IMeetingRepository meetingRepository,
        ILogger<MeetingAutoCloseJob> logger)
    {
        _meetingRepository = meetingRepository;
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
                    closedCount++;

                    _logger.LogInformation("Meeting {MeetingId} ({Number}) auto-closed", meeting.Id, meeting.Number);
                }
                catch (Exception ex)
                {
                    failedCount++;
                    _logger.LogError(ex, "Failed to auto-close meeting {MeetingId}", meeting.Id);
                }
            }

            // ذخیره تغییرات
            await _meetingRepository.SaveChangesAsync();


        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MeetingAutoCloseJob failed");

            throw; // Quartz می‌تواند retry کند
        }
    }

}