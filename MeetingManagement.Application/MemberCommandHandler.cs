using Epc.Application.Command;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Meeting;
using MeetingManagement.Application.Contracts.Member;
using MeetingManagement.Application.Services;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.MeetingAgg;
using MeetingManagement.Domain.RoleAgg;
using MeetingManagement.Domain.Shared.Access;
using MeetingManagement.Domain.Shared.Notifications;
using Microsoft.Extensions.Logging;

namespace MeetingManagement.Application;

/// <summary>
/// اعضا، حضور و غیاب، جانشین و امضای صورتجلسه.
/// ─────────────────────────────────────────────────────────────────────────
/// قوانین امضا:
///   • فقط در وضعیت «ثبت نهایی» و فقط برای جلساتی که صورتجلسه دارند
///   • هر کس فقط ردیف عضویت خودش را امضا می‌کند (با سمت فعال، یا کاربر بدون سمت)
///   • امضای رئیس اول است؛ پیش از آن هیچ عضو دیگری (حتی دبیر یا دبیر غیرعضو) نمی‌تواند امضا کند
///   • امضای رئیس قطعی است و پس‌گرفتنی نیست؛ سایر اعضا تا اتمام جلسه می‌توانند امضای خود را بردارند
///   • عضو غایب امضا نمی‌کند (جانشین او با ردیف خودش امضا می‌کند)
/// </summary>
public class MemberCommandHandler(
    IMeetingMemberRepository repository,
    IMeetingRepository meetingRepository,
    IRoleRepository roleRepository,
    IMeetingAccessService accessService,
    IActingIdentityResolver identityResolver,
    INotificationPublisher notificationPublisher,
    AssignmentPublication assignmentPublication,
    ILogger<MemberCommandHandler> logger
) : ICommandHandlerAsync<MeetingMemberDto, Result<long>>,
    ICommandHandlerAsync<DeleteMeetingMember, Result<bool>>,
    ICommandHandlerAsync<MeetingMemberCommentDto, Result<bool>>,
    ICommandHandlerAsync<CreateMemberDto, Result<bool>>,
    ICommandHandlerAsync<SetSubstituteDto, Result<bool>>,
    ICommandHandlerAsync<AttendanceMemberDto, Result<bool>>,
    ICommandHandlerAsync<AttendanceGroupDto, Result<bool>>
{
    // ═══════════════════════════════════════════════════════════
    // افزودن / ویرایش عضو
    // ═══════════════════════════════════════════════════════════
    public async Task<Result<long>> Handle(MeetingMemberDto command)
    {
        var check = await MeetingGuard.CheckAsync(accessService, command.MeetingGuid, MeetingCapability.ManageMembers);
        if (!check.Allowed) return check.Fail(0L);

        var meeting = await meetingRepository.LoadAsync(check.Access.MeetingId, "MeetingMembers");
        var uniqueError = ValidateUniqueRole(meeting, command.RoleId, command.Id);
        if (uniqueError is not null) return Result<long>.Failure(0, uniqueError);

        if (command.Id.HasValue)
        {
            var member = meeting.MeetingMembers.FirstOrDefault(m => m.Id == command.Id.Value);
            if (member == null)
                return Result<long>.Failure(0, "عضو مورد نظر در این جلسه یافت نشد.");
            if (member.IsSign == true && member.RoleId != command.RoleId)
                return Result<long>.Failure(0, "نقش عضوی که صورتجلسه را امضا کرده قابل تغییر نیست.");

            member.Edit(command);
            repository.Update(member);
            return Result<long>.Success(member.Id);
        }

        var identity = await identityResolver.ResolveAsync();
        var created = new MeetingMember(identity.TokenUserGuid, command, meeting.Id);
        await repository.CreateAsync(created);
        return Result<long>.Success(created.Id);
    }

    public async Task<Result<bool>> Handle(DeleteMeetingMember command)
    {
        var member = await repository.LoadAsync(command.Id);
        if (member == null)
            return Result<bool>.Failure(false, "عضو مورد نظر یافت نشد.");

        var check = await MeetingGuard.CheckAsync(accessService, member.MeetingId ?? 0, MeetingCapability.ManageMembers);
        if (!check.Allowed) return check.Fail(false);
        if (member.IsSign == true)
            return Result<bool>.Failure(false, "عضوی که صورتجلسه را امضا کرده قابل حذف نیست.");

        repository.Delete(member);
        return Result<bool>.Success(true);
    }

    /// <summary>افزودن کاربر به جلسه (با نقش) یا جایگزینی یک عضو با کاربر دیگر</summary>
    public async Task<Result<bool>> Handle(CreateMemberDto command)
    {
        if (command.UserGuid is null || command.UserGuid == Guid.Empty)
            return Result<bool>.Failure(false, "کاربر مورد نظر مشخص نشده است.");

        var check = await MeetingGuard.CheckAsync(accessService, command.MeetingGuid, MeetingCapability.ManageMembers);
        if (!check.Allowed) return check.Fail(false);

        var identity = await identityResolver.ResolveAsync();
        var meeting = await meetingRepository.LoadAsync(check.Access.MeetingId, "MeetingMembers");

        if (meeting.MeetingMembers.Any(m => m.UserGuid == command.UserGuid && m.Id != command.MemberId))
            return Result<bool>.Failure(false, "این کاربر قبلاً عضو جلسه است.");

        if (command.MemberId.HasValue)
        {
            var replaced = meeting.MeetingMembers.FirstOrDefault(c => c.Id == command.MemberId);
            if (replaced == null)
                return Result<bool>.Failure(false, "عضو مورد نظر یافت نشد.");

            replaced.SetReplacement(command.UserGuid);
            repository.Update(replaced);
            await repository.CreateAsync(new MeetingMember(identity.TokenUserGuid, new MeetingMemberDto
            {
                UserGuid = command.UserGuid,
                IsExternal = false,
                RoleId = replaced.RoleId ?? 0,
                MeetingGuid = command.MeetingGuid,
            }, meeting.Id));
            return Result<bool>.Success(true);
        }

        if (command.RoleGuid is null)
            return Result<bool>.Failure(false, "نقش عضو مشخص نشده است.");

        var roleId = await roleRepository.GetIdByAsync(command.RoleGuid.Value);
        var uniqueError = ValidateUniqueRole(meeting, roleId, null);
        if (uniqueError is not null) return Result<bool>.Failure(false, uniqueError);

        await repository.CreateAsync(new MeetingMember(identity.TokenUserGuid, new MeetingMemberDto
        {
            UserGuid = command.UserGuid,
            RoleId = roleId,
            IsExternal = false,
            MeetingGuid = command.MeetingGuid,
        }, meeting.Id));
        return Result<bool>.Success(true);
    }

    // ═══════════════════════════════════════════════════════════
    // نظر و امضای صورتجلسه
    // ═══════════════════════════════════════════════════════════
    public async Task<Result<bool>> Handle(MeetingMemberCommentDto command)
    {
        var member = await repository.LoadAsync(command.MemberId);
        if (member == null)
            return Result<bool>.Failure(false, "عضو مورد نظر یافت نشد.");

        var meetingId = member.MeetingId ?? 0;
        var access = await accessService.GetAsync(meetingId);
        if (!access.Exists)
            return Result<bool>.Failure(false, "جلسه مورد نظر یافت نشد.");
        if (!access.Workflow.HasMinutes)
            return Result<bool>.Failure(false, "این نوع جلسه صورتجلسه‌ی امضایی ندارد.");
        if (access.StatusId != MeetingStatusIds.Finalized)
            return Result<bool>.Failure(false, "نظر و امضا فقط پس از ثبت نهایی جلسه و پیش از اتمام آن امکان‌پذیر است.");

        var identity = await identityResolver.ResolveAsync();
        if (!IsOwnMembership(member, identity))
            return Result<bool>.Failure(false, "هر عضو فقط می‌تواند صورتجلسه را به نام خودش امضا کند.");

        if (command.Comment is not null)
        {
            if (!access.Can(MeetingCapability.CommentOnMinutes))
                return Result<bool>.Failure(false, MeetingAccess.DeniedMessage(MeetingCapability.CommentOnMinutes));
            member.SetComment(command.Comment);
        }

        var signResult = await ApplySignatureAsync(member, command.IsSign, access, identity);
        if (signResult is not null) return Result<bool>.Failure(false, signResult);

        repository.Update(member);
        return Result<bool>.Success(true);
    }

    /// <returns>پیام خطا یا null</returns>
    private async Task<string?> ApplySignatureAsync(MeetingMember member, bool? wantSign, MeetingAccess access, ActingIdentity identity)
    {
        if (wantSign is null || wantSign == (member.IsSign == true)) return null;

        var isChairman = MeetingRoles.Is(member.RoleId, MeetingRoleKey.Chairman);

        if (wantSign == false)
        {
            if (isChairman)
                return "امضای رئیس جلسه قطعی است و قابل برداشتن نیست.";
            member.Unsign();
            return null;
        }

        if (!MeetingRoles.CapabilitiesOf(member.RoleId).HasFlag(MeetingCapability.SignMinutes))
            return MeetingAccess.DeniedMessage(MeetingCapability.SignMinutes);
        if (member.IsPresent == false)
            return "عضو غایب امکان امضای صورتجلسه را ندارد.";

        if (!isChairman && !access.ChairmanSigned)
            return "ابتدا رئیس جلسه باید صورتجلسه را امضا کند.";

        member.Sign(identity.TokenUserGuid);

        if (isChairman)
        {
            await PublishSafeAsync(NotificationEventCode.ChairmanSigned, new NotificationPayload
            {
                MeetingId = member.MeetingId,
                ActorUserGuid = identity.UserGuid,
            });
            // با امضای رئیس، تخصیص‌های جلسه ابلاغ می‌شوند (در کارتابل اقدام‌کنندگان دیده می‌شوند)
            await assignmentPublication.NotifyMeetingAssignmentsAsync(member.MeetingId ?? 0, identity.UserGuid);
        }

        return null;
    }

    // ═══════════════════════════════════════════════════════════
    // اعلام حضور / معرفی جانشین (توسط خود عضو)
    // ═══════════════════════════════════════════════════════════
    public async Task<Result<bool>> Handle(SetSubstituteDto command)
    {
        var member = await repository.LoadAsync(command.Id ?? 0);
        if (member == null) return Result<bool>.Failure(false, "عضو مورد نظر یافت نشد");

        var meeting = await meetingRepository.LoadAsync(member.MeetingId ?? 0, "MeetingMembers");
        var access = await accessService.GetAsync(meeting.Id);
        if (access.StatusId != MeetingStatusIds.Registered)
            return Result<bool>.Failure(false, "اعلام حضور فقط پیش از برگزاری جلسه امکان‌پذیر است.");

        var identity = await identityResolver.ResolveAsync();
        var isSelf = IsOwnMembership(member, identity);
        if (!isSelf && !access.Can(MeetingCapability.ManageAttendance))
            return Result<bool>.Failure(false, "فقط خود عضو یا مدیر جلسه می‌تواند حضور را اعلام کند.");

        member.SetAttendance(command.IsAttendance);

        if (command.IsAttendance)
        {
            RemoveSubstitute(meeting, member);
        }
        else if (command.ReplacementUserGuid is { } replacementUser && replacementUser != Guid.Empty)
        {
            if (meeting.NotAllowReplacement == true)
                return Result<bool>.Failure(false, "برای این جلسه امکان معرفی جانشین وجود ندارد.");
            if (!access.Can(MeetingCapability.AppointSubstitute) && !MeetingRoles.CapabilitiesOf(member.RoleId).HasFlag(MeetingCapability.AppointSubstitute))
                return Result<bool>.Failure(false, MeetingAccess.DeniedMessage(MeetingCapability.AppointSubstitute));
            if (replacementUser == member.UserGuid)
                return Result<bool>.Failure(false, "عضو نمی‌تواند خودش را به‌عنوان جانشین معرفی کند.");

            // جانشین قبلی (اگر بود) کنار گذاشته می‌شود
            RemoveSubstitute(meeting, member);

            var substitute = meeting.MeetingMembers.FirstOrDefault(c => c.UserGuid == replacementUser);
            if (substitute == null)
            {
                substitute = new MeetingMember(identity.TokenUserGuid, new MeetingMemberDto
                {
                    UserGuid = replacementUser,
                    RoleId = member.RoleId ?? 0,
                    MeetingGuid = meeting.Guid!.Value,
                    IsExternal = false,
                    PositionGuid = command.ReplacementPositionGuid,
                    PersNo = command.PersNo,
                }, meeting.Id);
                await repository.CreateAsync(substitute);
            }
            else
            {
                // جانشین خودش عضو جلسه است: نقش جانشینی می‌گیرد و نقش اصلی‌اش در MainRoleId حفظ می‌شود
                substitute.Edit(new MeetingMemberDto
                {
                    RoleId = member.RoleId ?? 0,
                    UserGuid = substitute.UserGuid,
                    PositionGuid = substitute.PositionGuid,
                    SignatureGuid = substitute.Signature,
                    ProfileGuid = substitute.Profile,
                    Name = substitute.Name,
                    Mobile = substitute.Mobile,
                    Email = substitute.Email,
                    Organization = substitute.Organization,
                    IsExternal = substitute.IsExternal ?? false,
                    MainRoleId = substitute.MainRoleId ?? substitute.RoleId,
                    PersNo = substitute.PersNo,
                    Gender = substitute.Gender,
                });
                repository.Update(substitute);
            }

            member.SetReplacement(replacementUser);

            await PublishSafeAsync(NotificationEventCode.SubstituteAssigned, new NotificationPayload
            {
                MeetingId = meeting.Id,
                ActorUserGuid = identity.UserGuid,
                Targets = [new NotificationTarget(NotificationRecipient.Substitute, replacementUser, command.ReplacementPositionGuid)],
            });
        }

        repository.Update(member);
        return Result<bool>.Success(true);
    }

    /// <summary>برداشتن جانشین یک عضو: اگر جانشین خودش عضو بود نقش اصلی‌اش برمی‌گردد، وگرنه حذف می‌شود.</summary>
    private void RemoveSubstitute(Meeting meeting, MeetingMember member)
    {
        if (member.ReplacementUserGuid is not { } replacement) return;

        var substitute = meeting.MeetingMembers.FirstOrDefault(c => c.UserGuid == replacement && c.Id != member.Id);
        if (substitute != null)
        {
            if (substitute.MainRoleId != null)
            {
                substitute.SetMainRole();
                repository.Update(substitute);
            }
            else if (substitute.IsSign != true)
            {
                repository.Delete(substitute);
            }
        }

        member.SetReplacement(null);
    }

    // ═══════════════════════════════════════════════════════════
    // حضور و غیاب (توسط دبیر)
    // ═══════════════════════════════════════════════════════════
    public async Task<Result<bool>> Handle(AttendanceMemberDto command)
    {
        var member = await repository.LoadAsync(command.Id ?? 0);
        if (member == null) return Result<bool>.Failure(false, "عضو مورد نظر یافت نشد");

        var check = await MeetingGuard.CheckAsync(accessService, member.MeetingId ?? 0, MeetingCapability.ManageAttendance);
        if (!check.Allowed) return check.Fail(false);
        if (member.IsSign == true && !command.IsPresent)
            return Result<bool>.Failure(false, "عضوی که صورتجلسه را امضا کرده نمی‌تواند غایب ثبت شود.");

        member.SetPresence(command.IsPresent);
        repository.Update(member);
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> Handle(AttendanceGroupDto command)
    {
        var check = await MeetingGuard.CheckAsync(accessService, command.MeetingGuid, MeetingCapability.ManageAttendance);
        if (!check.Allowed) return check.Fail(false);

        var meeting = await meetingRepository.LoadAsync(check.Access.MeetingId, "MeetingMembers");
        if (meeting.MeetingMembers.Count == 0)
            return Result<bool>.Failure(false, "هیچ عضوی یافت نشد");

        foreach (var member in meeting.MeetingMembers.Where(m => command.IsPresent || m.IsSign != true))
        {
            member.SetPresence(command.IsPresent);
            repository.Update(member);
        }
        return Result<bool>.Success(true);
    }

    // ═══════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════

    /// <summary>این ردیف عضویت متعلق به کاربر/سمت فعال است؟</summary>
    private static bool IsOwnMembership(MeetingMember member, ActingIdentity identity) =>
        (member.PositionGuid is { } p && p == identity.PositionGuid)
        || (member.PositionGuid is null && member.UserGuid == identity.UserGuid);

    private static string? ValidateUniqueRole(Meeting meeting, int roleId, long? exceptMemberId)
    {
        var definition = MeetingRoles.Get(roleId);
        if (definition is not { IsUnique: true }) return null;

        // ردیف جانشین‌ها (کاربری که جای یک عضو آمده) شمرده نمی‌شود
        var substituteUsers = meeting.MeetingMembers.Where(m => m.ReplacementUserGuid != null)
            .Select(m => m.ReplacementUserGuid).ToHashSet();

        return meeting.MeetingMembers.Any(m => m.RoleId == roleId && m.Id != exceptMemberId
                                               && m.MainRoleId == null && !substituteUsers.Contains(m.UserGuid))
            ? $"نقش «{definition.Key.GetDescription()}» در هر جلسه فقط یک نفر می‌تواند باشد."
            : null;
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
