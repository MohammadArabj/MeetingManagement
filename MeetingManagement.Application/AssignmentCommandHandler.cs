using Epc.Application.Command;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Action;
using MeetingManagement.Application.Contracts.Assignment;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.ActionAgg;
using MeetingManagement.Domain.AssignmentAgg;
using MeetingManagement.Domain.ResolutionAgg;
using MeetingManagement.Domain.SettingAgg;
using MeetingManagement.Domain.Shared.Access;
using MeetingManagement.Domain.Shared.Notifications;
using Microsoft.Extensions.Logging;

namespace MeetingManagement.Application;

/// <summary>
/// عملیات تخصیص، ارجاع و نتیجه.
/// ─────────────────────────────────────────────────────────────────────────
/// تصمیم‌های طراحی ارجاع (بدون تغییر اسکیما):
///   • «سمت عامل» از سرور تعیین می‌شود (IActingIdentityResolver)؛ PositionGuid ارسالی کلاینت فقط
///     برای سازگاری با توکن‌های قدیمی پذیرفته می‌شود.
///   • فقط اقدام‌کننده‌ی فعلی تخصیص (یا مدیر سامانه) می‌تواند ارجاع دهد.
///   • قوانین چرخه/عمق/مهلت/تکرار در Domain (<see cref="Assignment.CreateReferral"/>) اعمال می‌شوند.
///   • ثبت نتیجه روی تخصیص اصلی → همه‌ی ارجاع‌های باز زیرمجموعه بسته می‌شوند.
///   • ارجاع‌گیرنده «بازگشت ارجاع» انجام می‌دهد → شرح او به‌صورت اقدام روی تخصیص والد ثبت می‌شود.
///   • ارجاع‌دهنده می‌تواند ارجاع را فراخوانی کند (اگر کاری انجام نشده حذف، وگرنه بسته با سابقه).
/// </summary>
public class AssignmentCommandHandler(
    IAssignmentRepository repository,
    IResolutionRepository resolutionRepository,
    IActionRepository actionRepository,
    IMeetingAccessService accessService,
    IActingIdentityResolver identityResolver,
    INotificationPublisher notificationPublisher,
    ILogger<AssignmentCommandHandler> logger) :
    ICommandHandlerAsync<AssignmentDto, Result<bool>>,
    ICommandHandlerAsync<DeleteAssignmentDto, Result<bool>>,
    ICommandHandlerAsync<AssignmentChangeStatusDto, Result<bool>>,
    ICommandHandlerAsync<AssignmentReferralDto, Result<bool>>,
    ICommandHandlerAsync<ChangeAssignmentResultDto, Result<bool>>,
    ICommandHandlerAsync<ReturnReferralDto, Result<bool>>,
    ICommandHandlerAsync<RecallReferralDto, Result<bool>>
{
    // ═══════════════════════════════════════════════════════════
    // ایجاد/ویرایش تخصیص (از مودال تخصیص در محتوای جلسه)
    // ═══════════════════════════════════════════════════════════
    public async Task<Result<bool>> Handle(AssignmentDto command)
    {
        var resolution = await resolutionRepository.LoadForEditAsync(command.ResolutionId);
        if (resolution == null)
            return Result<bool>.Failure(false, "مصوبه مورد نظر یافت نشد.");

        var access = await accessService.GetAsync(resolution.MeetingId);
        if (!access.CanManageAssignments)
            return Result<bool>.Failure(false, access.Can(MeetingCapability.ManageAssignments)
                ? MeetingAccess.LockedMessage
                : MeetingAccess.DeniedMessage(MeetingCapability.ManageAssignments));

        if (command.ActorGuid is null || command.ActorGuid == Guid.Empty)
            return Result<bool>.Failure(false, "اقدام‌کننده الزامی است.");
        if (string.IsNullOrWhiteSpace(command.DueDate))
            return Result<bool>.Failure(false, "مهلت انجام الزامی است.");

        var identity = await identityResolver.ResolveAsync();

        if (command.Id.HasValue)
        {
            var assignment = resolution.AssignedMembers.FirstOrDefault(c => c.Id == command.Id.Value);
            if (assignment == null)
                return Result<bool>.Failure(false, "تخصیص مورد نظر یافت نشد.");
            if (assignment.IsReferral)
                return Result<bool>.Failure(false, "ارجاع‌ها از این بخش قابل ویرایش نیستند.");

            assignment.Edit(command.ActorGuid, command.FollowerGuid, command.ActorPositionGuid,
                command.FollowerPositionGuid, command.Type, command.DueDate, resolution.Id);
            repository.Update(assignment);
        }
        else
        {
            resolution.AssignedMembers.Add(new Assignment(command.ActorGuid, command.FollowerGuid, command.ActorPositionGuid,
                command.FollowerPositionGuid, command.Type, command.DueDate, resolution.Id, ActionStatus.Pending,
                creator: identity.TokenUserGuid));
            resolutionRepository.Update(resolution);

            // پیش از ابلاغ (امضای رئیس / اتمام جلسه) پیامی ارسال نمی‌شود؛ هنگام ابلاغ برای همه ارسال می‌شود
            if (access.IsPublished)
                await PublishSafeAsync(NotificationEventCode.ResolutionAssigned, new NotificationPayload
            {
                MeetingId = resolution.MeetingId,
                ResolutionId = resolution.Id,
                ActorUserGuid = identity.TokenUserGuid,
                Targets = [new NotificationTarget(NotificationRecipient.Actor, command.ActorGuid, command.ActorPositionGuid)],
                Values = { ["DueDate"] = command.DueDate },
            });
        }

        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> Handle(DeleteAssignmentDto command)
    {
        var assignment = await repository.LoadWithChildrenAsync(command.Id);
        if (assignment == null)
            return Result<bool>.Failure(false, "تخصیص مصوبه یافت نشد.");

        var access = await accessService.GetByResolutionAsync(assignment.ResolutionId);
        if (!access.CanManageAssignments)
            return Result<bool>.Failure(false, MeetingAccess.DeniedMessage(MeetingCapability.ManageAssignments));

        if (!assignment.CanBeDeleted(out var reason))
            return Result<bool>.Failure(false, reason!);

        repository.Delete(assignment);
        return Result<bool>.Success(true);
    }

    // ═══════════════════════════════════════════════════════════
    // پایان پیگیری / پایان اقدام
    // ═══════════════════════════════════════════════════════════
    public async Task<Result<bool>> Handle(AssignmentChangeStatusDto command)
    {
        var assignment = await repository.LoadAsync(command.Id);
        if (assignment == null)
            return Result<bool>.Failure(false, "تخصیص مورد نظر یافت نشد");

        var publishError = await EnsurePublishedAsync(assignment.ResolutionId);
        if (publishError is not null) return Result<bool>.Failure(false, publishError);

        var identity = await identityResolver.ResolveAsync();
        var position = identity.PositionGuid ?? command.PositionGuid;

        if (command.IsFollower)
        {
            if (!identity.IsSuperAdmin && assignment.FollowerPositionGuid != position)
                return Result<bool>.Failure(false, "فقط پیگیری‌کننده می‌تواند پیگیری را پایان دهد.");
            if (!assignment.IsEnded)
                return Result<bool>.Failure(false, "پیگیری فقط بعد از پایان اقدام قابل پایان است.");
            assignment.ChangeFollowStatus(ActionFollowStatus.End);
        }
        else
        {
            if (!identity.IsSuperAdmin && (assignment.ActorPositionGuid != position || assignment.ParentAssignmentId.HasValue))
                return Result<bool>.Failure(false, "فقط اقدام‌کننده‌ی اصلی می‌تواند اقدام را پایان دهد.");
            assignment.ChangeStatus(ActionStatus.End);
            await CloseOpenReferralsAsync(assignment);
        }

        repository.Update(assignment);
        return Result<bool>.Success(true);
    }

    // ═══════════════════════════════════════════════════════════
    // ارجاع
    // ═══════════════════════════════════════════════════════════
    public async Task<Result<bool>> Handle(AssignmentReferralDto command)
    {
        if (command.ActorGuid == Guid.Empty)
            return Result<bool>.Failure(false, "ارجاع‌گیرنده الزامی است.");

        var tree = await repository.GetResolutionTreeAsync(
            (await repository.LoadAsync(command.ParentAssignmentId))?.ResolutionId ?? -1);
        var parent = tree.FirstOrDefault(a => a.Id == command.ParentAssignmentId);
        if (parent == null)
            return Result<bool>.Failure(false, "تخصیص والد یافت نشد.");

        var publishError = await EnsurePublishedAsync(parent.ResolutionId);
        if (publishError is not null) return Result<bool>.Failure(false, publishError);

        var identity = await identityResolver.ResolveAsync();
        var referrerPosition = identity.PositionGuid ?? command.ReferrerPositionGuid;

        // ✅ قبلاً این کنترل comment شده بود و هر کسی می‌توانست هر تخصیصی را ارجاع دهد
        if (!identity.IsSuperAdmin &&
            !Assignment.SamePerson(identity.UserGuid, referrerPosition, parent.ActorGuid, parent.ActorPositionGuid))
            return Result<bool>.Failure(false, "فقط اقدام‌کننده‌ی این تخصیص می‌تواند آن را ارجاع دهد.");

        var chain = BuildAncestorChain(parent, tree);

        try
        {
            var referral = parent.CreateReferral(
                command.ActorGuid,
                command.ActorPositionGuid,
                identity.UserGuid,
                referrerPosition,
                command.ReferralNote,
                command.DueDate,
                chain,
                SettingValues.ReferralMaxDepth,
                SettingValues.ReferralAllowLaterDueDate);

            repository.Update(parent);

            var meetingId = (await accessService.GetByResolutionAsync(parent.ResolutionId)).MeetingId;
            await PublishSafeAsync(NotificationEventCode.AssignmentReferred, new NotificationPayload
            {
                MeetingId = meetingId,
                ResolutionId = parent.ResolutionId,
                ActorUserGuid = identity.TokenUserGuid,
                Targets = [new NotificationTarget(NotificationRecipient.Actor, referral.ActorGuid, referral.ActorPositionGuid)],
                Values =
                {
                    ["DueDate"] = command.DueDate,
                    ["ReferrerUserGuid"] = identity.UserGuid.ToString(),
                },
            });

            return Result<bool>.Success(true);
        }
        catch (InvalidOperationException ex)
        {
            return Result<bool>.Failure(false, ex.Message);
        }
    }

    public async Task<Result<bool>> Handle(ReturnReferralDto command)
    {
        var referral = await repository.LoadWithChildrenAsync(command.AssignmentId);
        if (referral == null)
            return Result<bool>.Failure(false, "ارجاع یافت نشد.");

        var identity = await identityResolver.ResolveAsync();
        if (!identity.IsSuperAdmin &&
            !Assignment.SamePerson(identity.UserGuid, identity.PositionGuid, referral.ActorGuid, referral.ActorPositionGuid))
            return Result<bool>.Failure(false, "فقط ارجاع‌گیرنده می‌تواند ارجاع را بازگرداند.");

        if (referral.ReferredAssignments.Any(r => !r.IsEnded))
            return Result<bool>.Failure(false, "ابتدا ارجاع‌های باز زیرمجموعه را تعیین تکلیف کنید.");

        try
        {
            var parentAction = referral.ReturnReferral(identity.UserGuid, command.Description.Trim(), command.Result);
            await actionRepository.CreateAsync(parentAction);
            repository.Update(referral);

            await PublishSafeAsync(NotificationEventCode.ReferralReturned, new NotificationPayload
            {
                ResolutionId = referral.ResolutionId,
                MeetingId = (await accessService.GetByResolutionAsync(referral.ResolutionId)).MeetingId,
                ActorUserGuid = identity.TokenUserGuid,
                Targets = [new NotificationTarget(NotificationRecipient.Referrer, referral.ReferrerGuid, referral.ReferrerPositionGuid)],
                Values = { ["ActorUserGuid"] = identity.UserGuid.ToString() },
            });

            return Result<bool>.Success(true);
        }
        catch (InvalidOperationException ex)
        {
            return Result<bool>.Failure(false, ex.Message);
        }
    }

    public async Task<Result<bool>> Handle(RecallReferralDto command)
    {
        var referral = await repository.LoadWithChildrenAsync(command.AssignmentId);
        if (referral == null || !referral.IsReferral)
            return Result<bool>.Failure(false, "ارجاع یافت نشد.");

        var identity = await identityResolver.ResolveAsync();
        if (!identity.IsSuperAdmin &&
            !Assignment.SamePerson(identity.UserGuid, identity.PositionGuid, referral.ReferrerGuid, referral.ReferrerPositionGuid))
            return Result<bool>.Failure(false, "فقط ارجاع‌دهنده می‌تواند ارجاع را فراخوانی کند.");

        try
        {
            if (referral.CanBeRecalledByDelete)
            {
                repository.Delete(referral);
            }
            else
            {
                var tree = await repository.GetResolutionTreeAsync(referral.ResolutionId);
                foreach (var d in Descendants(referral.Id, tree)) d.CloseByParent();
                referral.MarkRecalled(command.Reason);
                repository.Update(referral);
            }
            return Result<bool>.Success(true);
        }
        catch (InvalidOperationException ex)
        {
            return Result<bool>.Failure(false, ex.Message);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // نتیجه تخصیص
    // ═══════════════════════════════════════════════════════════
    public async Task<Result<bool>> Handle(ChangeAssignmentResultDto command)
    {
        var assignment = await repository.LoadAsync(command.Id);
        if (assignment == null)
            return Result<bool>.Failure(false, "تخصیص یافت نشد");

        var publishError = await EnsurePublishedAsync(assignment.ResolutionId);
        if (publishError is not null) return Result<bool>.Failure(false, publishError);

        var identity = await identityResolver.ResolveAsync();
        var position = identity.PositionGuid ?? command.PositionGuid;

        if (!identity.IsSuperAdmin && assignment.ActorPositionGuid != position)
            return Result<bool>.Failure(false, "فقط اقدام‌کننده می‌تواند نتیجه اقدام را ثبت کند.");
        if (assignment.ParentAssignmentId.HasValue)
            return Result<bool>.Failure(false, "برای ارجاع از «بازگشت ارجاع» استفاده کنید؛ نتیجه فقط روی تخصیص اصلی ثبت می‌شود.");
        if (assignment.IsEnded)
            return Result<bool>.Failure(false, "برای این تخصیص قبلاً نتیجه ثبت شده است.");

        assignment.CreateActionResult(command.Result, command.Date, command.Description);
        if (assignment.ActorPositionGuid == assignment.FollowerPositionGuid)
            assignment.ChangeFollowStatus(ActionFollowStatus.End);

        // ✅ بستن آبشاری ارجاع‌های باز (قبلاً به‌صورت TODO رها شده بود)
        await CloseOpenReferralsAsync(assignment);
        repository.Update(assignment);

        await PublishSafeAsync(NotificationEventCode.AssignmentCompleted, new NotificationPayload
        {
            ResolutionId = assignment.ResolutionId,
            MeetingId = (await accessService.GetByResolutionAsync(assignment.ResolutionId)).MeetingId,
            ActorUserGuid = identity.TokenUserGuid,
            Targets = [new NotificationTarget(NotificationRecipient.Follower, assignment.FollowerGuid, assignment.FollowerPositionGuid)],
            Values = { ["ActorUserGuid"] = assignment.ActorGuid?.ToString() },
        });

        return Result<bool>.Success(true);
    }

    // ═══════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════
    private async Task CloseOpenReferralsAsync(Assignment root)
    {
        var tree = await repository.GetResolutionTreeAsync(root.ResolutionId);
        foreach (var d in Descendants(root.Id, tree))
            d.CloseByParent();
    }

    private static List<Assignment> BuildAncestorChain(Assignment node, List<Assignment> tree)
    {
        var chain = new List<Assignment>();
        var visited = new HashSet<int>();
        var current = node;
        while (current is not null && visited.Add(current.Id))
        {
            chain.Add(current);
            current = current.ParentAssignmentId is { } pid ? tree.FirstOrDefault(a => a.Id == pid) : null;
        }
        return chain;
    }

    private static IEnumerable<Assignment> Descendants(int rootId, List<Assignment> tree)
    {
        var stack = new Stack<int>();
        stack.Push(rootId);
        var visited = new HashSet<int> { rootId };
        while (stack.Count > 0)
        {
            var id = stack.Pop();
            foreach (var child in tree.Where(a => a.ParentAssignmentId == id))
            {
                if (!visited.Add(child.Id)) continue;
                yield return child;
                stack.Push(child.Id);
            }
        }
    }

    private async Task<string?> EnsurePublishedAsync(long resolutionId)
    {
        var access = await accessService.GetByResolutionAsync(resolutionId);
        if (!access.Exists) return "جلسه‌ی این تخصیص یافت نشد.";
        return access.IsPublished ? null : "تخصیص هنوز ابلاغ نشده است (پس از امضای رئیس / اتمام جلسه).";
    }

    private async Task PublishSafeAsync(NotificationEventCode code, NotificationPayload payload)
    {
        try
        {
            await notificationPublisher.PublishAsync(code, payload);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Publishing {Code} failed", code);
        }
    }
}
