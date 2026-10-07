using Epc.Application.Command;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Action;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.ActionAgg;
using MeetingManagement.Domain.AssignmentAgg;
using MeetingManagement.Domain.Shared.Access;
using MeetingManagement.Domain.Shared.Notifications;
using Microsoft.Extensions.Logging;
using Action = MeetingManagement.Domain.ActionAgg.Action;

namespace MeetingManagement.Application;

/// <summary>
/// ثبت اقدام (توسط اقدام‌کننده) و پیگیری (توسط پیگیری‌کننده).
/// تغییرات: کنترل مالکیت سمت سرور، ممنوعیت ثبت روی تخصیص پایان‌یافته، و انتشار رویداد «ثبت اقدام».
/// </summary>
public class ActionCommandHandler(
    IActionRepository repository,
    IAssignmentRepository assignmentRepository,
    IActingIdentityResolver identityResolver,
    IMeetingAccessService accessService,
    INotificationPublisher notificationPublisher,
    ILogger<ActionCommandHandler> logger)
    : ICommandHandlerAsync<ActionDto, Result<bool>>,
      ICommandHandlerAsync<DeleteActionDto, Result<bool>>,
      ICommandHandlerAsync<ReviewActionDto, Result<bool>>
{
    public async Task<Result<bool>> Handle(ActionDto command)
    {
        if (string.IsNullOrWhiteSpace(command.Description))
            return Result<bool>.Failure(false, "شرح اقدام الزامی است.");

        var identity = await identityResolver.ResolveAsync();

        if (command.Id.HasValue)
        {
            var action = await repository.LoadAsync(command.Id.Value, "Assignment");
            if (action == null)
                return Result<bool>.Failure(false, "اقدام یافت نشد.");
            if (!identity.IsSuperAdmin && action.UserGuid != identity.UserGuid && action.CreatedBy != identity.TokenUserGuid)
                return Result<bool>.Failure(false, "شما مجاز به ویرایش این اقدام نیستید.");

            action.Edit(command.ActionDate ?? Assignment.ToShamsi(DateTime.Now), command.Description);
            repository.Update(action);
            return Result<bool>.Success(true);
        }

        var assignment = await assignmentRepository.LoadWithChildrenAsync(command.AssignmentId);
        if (assignment == null)
            return Result<bool>.Failure(false, "تخصیص یافت نشد.");

        var meetingAccess = await accessService.GetByResolutionAsync(assignment.ResolutionId);
        if (!meetingAccess.IsPublished)
            return Result<bool>.Failure(false, "تخصیص هنوز ابلاغ نشده است.");
        if (await IsChainEndedAsync(assignment))
            return Result<bool>.Failure(false, "تخصیص اصلی این ارجاع پایان یافته است؛ ثبت اقدام امکان‌پذیر نیست.");

        var isActor = Assignment.SamePerson(identity.UserGuid, identity.PositionGuid, assignment.ActorGuid, assignment.ActorPositionGuid);
        var isFollower = Assignment.SamePerson(identity.UserGuid, identity.PositionGuid, assignment.FollowerGuid, assignment.FollowerPositionGuid);

        // دبیر/مدیر جلسه (دارنده ManageAssignments) هم مجاز است به نیابت ثبت کند
        var isManager = !isActor && !isFollower && meetingAccess.Can(MeetingCapability.ManageAssignments);

        if (!identity.IsSuperAdmin && !isManager)
        {
            if (command.Type == ActionType.Action && !isActor)
                return Result<bool>.Failure(false, "فقط اقدام‌کننده می‌تواند اقدام ثبت کند.");
            if (command.Type == ActionType.Follow && !isFollower)
                return Result<bool>.Failure(false, "فقط پیگیری‌کننده می‌تواند پیگیری ثبت کند.");
        }

        if (command.Type == ActionType.Action && assignment.IsEnded)
            return Result<bool>.Failure(false, "این تخصیص پایان یافته است.");

        var newAction = new Action(identity.TokenUserGuid, command.AssignmentId, command.Description.Trim(),
            command.ActionDate ?? Assignment.ToShamsi(DateTime.Now),
            // ثبت به نام شخص دیگر فقط برای مدیر جلسه (ثبت به نیابت اقدام‌کننده)
            (isManager || identity.IsSuperAdmin) && command.UserGuid != Guid.Empty ? command.UserGuid : identity.UserGuid,
            command.Type);

        if (command.Type == ActionType.Action && assignment.ActionStatus == ActionStatus.Pending)
            assignment.ChangeStatus(ActionStatus.InProgress);
        else if (command.Type == ActionType.Follow && assignment.FollowStatus == ActionFollowStatus.Pending)
            assignment.ChangeFollowStatus(ActionFollowStatus.InProgress);

        assignmentRepository.Update(assignment);
        await repository.CreateAsync(newAction);

        if (command.Type == ActionType.Action)
        {
            try
            {
                await notificationPublisher.PublishAsync(NotificationEventCode.ActionRegistered, new NotificationPayload
                {
                    ResolutionId = assignment.ResolutionId,
                    MeetingId = meetingAccess.MeetingId,
                    ActorUserGuid = identity.TokenUserGuid,
                    Targets = [new NotificationTarget(NotificationRecipient.Follower, assignment.FollowerGuid, assignment.FollowerPositionGuid)],
                    Values = { ["ActorUserGuid"] = identity.UserGuid.ToString() },
                });
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Publishing ActionRegistered failed");
            }
        }

        return Result<bool>.Success(true);
    }

    /// <summary>آیا این تخصیص یا یکی از اجدادش پایان یافته است؟</summary>
    private async Task<bool> IsChainEndedAsync(Assignment assignment)
    {
        if (!assignment.IsReferral) return false;
        var tree = await assignmentRepository.GetResolutionTreeAsync(assignment.ResolutionId);
        var visited = new HashSet<int>();
        for (var current = tree.FirstOrDefault(a => a.Id == assignment.ParentAssignmentId);
             current is not null && visited.Add(current.Id);
             current = tree.FirstOrDefault(a => a.Id == current.ParentAssignmentId))
        {
            if (current.IsEnded) return true;
        }
        return false;
    }

    public async Task<Result<bool>> Handle(DeleteActionDto command)
    {
        var action = await repository.LoadAsync(command.Id);
        if (action == null)
            return Result<bool>.Failure(false, "اقدام یافت نشد.");

        var identity = await identityResolver.ResolveAsync();
        if (!identity.IsSuperAdmin && action.UserGuid != identity.UserGuid && action.CreatedBy != identity.TokenUserGuid)
            return Result<bool>.Failure(false, "فقط ثبت‌کننده‌ی اقدام می‌تواند آن را حذف کند.");

        repository.Delete(action);
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> Handle(ReviewActionDto command)
    {
        var action = await repository.LoadAsync(command.Id);
        if (action == null)
            return Result<bool>.Failure(false, "اقدام یافت نشد.");

        var assignment = await assignmentRepository.LoadAsync(action.AssignmentId);
        if (assignment == null)
            return Result<bool>.Failure(false, "تخصیص یافت نشد.");

        var identity = await identityResolver.ResolveAsync();
        if (!identity.IsSuperAdmin &&
            !Assignment.SamePerson(identity.UserGuid, identity.PositionGuid, assignment.FollowerGuid, assignment.FollowerPositionGuid))
            return Result<bool>.Failure(false, "شما مجاز به بررسی این اقدام نیستید.");

        repository.Update(action);
        return Result<bool>.Success(true);
    }
}
