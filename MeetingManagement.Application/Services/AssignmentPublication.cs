using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.AssignmentAgg;
using MeetingManagement.Domain.Shared.Notifications;
using Microsoft.Extensions.Logging;

namespace MeetingManagement.Application.Services;

/// <summary>
/// «ابلاغ» تخصیص‌ها: تخصیص‌ها تا امضای رئیس (یا اتمام جلسه‌ی هیئت مدیره) در کارتابل اقدام‌کننده دیده نمی‌شوند،
/// پس پیام «تخصیص مصوبه» هم باید همان لحظه ارسال شود، نه هنگام ثبت تخصیص در جلسه.
/// </summary>
public sealed class AssignmentPublication(
    IAssignmentRepository assignmentRepository,
    INotificationPublisher notificationPublisher,
    ILogger<AssignmentPublication> logger)
{
    public async Task NotifyMeetingAssignmentsAsync(long meetingId, Guid? actorUserGuid)
    {
        try
        {
            var assignments = await assignmentRepository.GetOriginalsByMeetingAsync(meetingId);
            foreach (var assignment in assignments)
            {
                await notificationPublisher.PublishAsync(NotificationEventCode.ResolutionAssigned, new NotificationPayload
                {
                    MeetingId = meetingId,
                    ResolutionId = assignment.ResolutionId,
                    AssignmentId = assignment.Id,
                    ActorUserGuid = actorUserGuid,
                    Targets = [new NotificationTarget(NotificationRecipient.Actor, assignment.ActorGuid, assignment.ActorPositionGuid)],
                    Values = { ["DueDate"] = assignment.DueDate is { } due ? Assignment.ToShamsi(due) : null },
                });
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Publishing assignments of meeting {MeetingId} failed", meetingId);
        }
    }
}
