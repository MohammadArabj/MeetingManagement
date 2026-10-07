using Epc.Application.Command;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Agenda;
using MeetingManagement.Application.Contracts.Meeting;
using MeetingManagement.Application.Services;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Common.Security;
using MeetingManagement.Domain.CategoryAgg;
using MeetingManagement.Domain.FileAgg;
using MeetingManagement.Domain.MeetingAgg;
using MeetingManagement.Domain.MeetingAgg.Service;
using MeetingManagement.Domain.RoomAgg;
using MeetingManagement.Domain.Shared.Access;
using MeetingManagement.Domain.Shared.Notifications;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using File = MeetingManagement.Domain.FileAgg.File;

namespace MeetingManagement.Application;

/// <summary>
/// ثبت، ویرایش و گردش وضعیت جلسه.
/// ─────────────────────────────────────────────────────────────────────────
///   • هر عملیات با توانایی کاربر در همان جلسه کنترل می‌شود (<see cref="MeetingGuard"/>)
///   • ثبت جلسه نیازمند دسترسی «ثبت اولیه» و مجوز سمت روی دسته‌بندی است
///   • انتقال وضعیت فقط طبق جدول <see cref="MeetingStatusIds.CanTransition"/> (مدیر سامانه می‌تواند به وضعیت قبلی برگردد)
///   • اتمام جلسه‌ی دارای صورتجلسه فقط پس از امضای رئیس
///   • با اتمام جلسه‌ی هیئت مدیره (یا امضای رئیس در جلسات عادی) تخصیص‌ها ابلاغ و اطلاع‌رسانی می‌شوند
/// </summary>
public class MeetingCommandHandler(
    IMeetingRepository repository,
    IMeetingService meetingService,
    IRoomRepository roomRepository,
    ICategoryRepository categoryRepository,
    ICategoryPermissionRepository categoryPermissionRepository,
    IFileRepository fileRepository,
    IHttpContextAccessor httpContextAccessor,
    IConfiguration configuration,
    IMeetingAccessService accessService,
    IActingIdentityResolver identityResolver,
    INotificationPublisher notificationPublisher,
    AssignmentPublication assignmentPublication,
    ILogger<MeetingCommandHandler> logger)
    : ICommandHandlerAsync<CreateMeetingDto, Result<CreateMeetingResultDto>>,
        ICommandHandlerAsync<MeetingDescriptionEditModel, Result<bool>>,
        ICommandHandlerAsync<ChangeStatusModel, Result<bool>>,
        ICommandHandlerAsync<DeleteMeetingDto, Result<bool>>,
        ICommandHandlerAsync<DeleteAgendaDto, Result<bool>>,
        ICommandHandlerAsync<CreateOrEditAgendaModel, Result<bool>>,
        ICommandHandlerAsync<EditMeetingDto, Result<bool>>,
        ICommandHandlerAsync<MeetingAttachmentDto, Result<bool>>,
        ICommandHandlerAsync<MeetingRiderDto, Result<UpdateRiderResultDto>>,
        ICommandHandlerAsync<DeleteRiderFileGuid, Result<bool>>
{
    private string? ClientId => httpContextAccessor.HttpContext?.Request.Headers["client-id"].ToString();

    // ═══════════════════════════════════════════════════════════
    // ثبت / ویرایش جلسه
    // ═══════════════════════════════════════════════════════════
    public async Task<Result<CreateMeetingResultDto>> Handle(CreateMeetingDto command)
    {
        var identity = await identityResolver.ResolveAsync();

        if (command.CategoryGuid is null)
            return Result<CreateMeetingResultDto>.Failure(null!, "دسته‌بندی جلسه مشخص نشده است.");
        if (command.Date is null || command.StartTime is null || command.EndTime is null)
            return Result<CreateMeetingResultDto>.Failure(null!, "تاریخ و ساعت جلسه الزامی است.");
        if (command.EndTime <= command.StartTime)
            return Result<CreateMeetingResultDto>.Failure(null!, "ساعت پایان جلسه باید بعد از ساعت شروع باشد.");

        if (command.Guid == null)
        {
            if (!identity.HasPermission(Permissions.MeetingsInitialRegister))
                return Result<CreateMeetingResultDto>.Failure(null!, "شما دسترسی ثبت جلسه را ندارید.");

            var categoryError = await ValidateCategoryAccessAsync(command.CategoryGuid.Value, identity);
            if (categoryError is not null) return Result<CreateMeetingResultDto>.Failure(null!, categoryError);

            if (command.StatusId is not (MeetingStatusIds.Draft or MeetingStatusIds.Registered))
                command.StatusId = MeetingStatusIds.Draft;

            var meeting = new Meeting(identity.TokenUserGuid, command, meetingService, repository, roomRepository, categoryRepository);
            meetingService.AddAgendas(meeting, identity.TokenUserGuid, ClientId, command.Agendas);
            await meetingService.AddMembers(meeting, identity.TokenUserGuid, ClientId, command.Members);

            await repository.CreateAsync(meeting);
            await repository.SaveChangesAsync();
            await ProcessAgendaFiles(meeting, identity.TokenUserGuid, command.Agendas);

            if (command.SendNotification && meeting.StatusId != MeetingStatusIds.Draft)
                await PublishSafeAsync(NotificationEventCode.MeetingCreated, meeting.Id);

            return Result<CreateMeetingResultDto>.Success(new CreateMeetingResultDto(meeting.Guid!.Value, meeting.Number));
        }

        var existing = await repository.LoadAsync(command.Guid.Value, "Agendas,MeetingMembers");
        if (existing == null)
            return Result<CreateMeetingResultDto>.Failure(null!, "جلسه مورد نظر یافت نشد");

        var check = await MeetingGuard.CheckAsync(accessService, existing.Id, MeetingCapability.EditMeeting);
        if (!check.Allowed) return check.Fail<CreateMeetingResultDto>(null!);
        if (existing.StatusId is not (MeetingStatusIds.Draft or MeetingStatusIds.Registered or MeetingStatusIds.Undetermined)
            && !check.Access.IsSuperAdmin)
            return Result<CreateMeetingResultDto>.Failure(null!, "اطلاعات جلسه پس از برگزاری قابل ویرایش نیست.");

        var newCategoryId = await categoryRepository.GetIdByAsync(command.CategoryGuid.Value);
        if (existing.CategoryId != newCategoryId)
        {
            var categoryError = await ValidateCategoryAccessAsync(command.CategoryGuid.Value, identity);
            if (categoryError is not null) return Result<CreateMeetingResultDto>.Failure(null!, categoryError);
        }

        var previousStatus = existing.StatusId;
        var previousSchedule = (existing.Date, existing.StartTime, existing.EndTime, existing.RoomId, existing.RoomName, existing.RoomLink);

        // وضعیت فقط از مسیر ChangeStatus تغییر می‌کند؛ اینجا فقط پیش‌نویس می‌تواند ثبت اولیه شود
        command.StatusId = previousStatus == MeetingStatusIds.Draft && command.StatusId == MeetingStatusIds.Registered
            ? MeetingStatusIds.Registered
            : previousStatus;

        existing.Edit(identity.TokenUserGuid, command, meetingService, repository, roomRepository, categoryRepository);
        if (command.StatusId != previousStatus)
            existing.ChangeStatus(identity.TokenUserGuid, command.StatusId!.Value);

        meetingService.AddAgendas(existing, identity.TokenUserGuid, ClientId, command.Agendas);
        await meetingService.AddMembers(existing, identity.TokenUserGuid, ClientId, command.Members);

        var scheduleChanged = previousSchedule != (existing.Date, existing.StartTime, existing.EndTime, existing.RoomId, existing.RoomName, existing.RoomLink);

        repository.Update(existing);
        await repository.SaveChangesAsync();
        await ProcessAgendaFiles(existing, identity.TokenUserGuid, command.Agendas);

        if (command.SendNotification)
        {
            var code = previousStatus == MeetingStatusIds.Draft && existing.StatusId == MeetingStatusIds.Registered
                ? NotificationEventCode.MeetingCreated
                : scheduleChanged && existing.StatusId != MeetingStatusIds.Draft ? NotificationEventCode.MeetingRescheduled : (NotificationEventCode?)null;
            if (code is not null) await PublishSafeAsync(code.Value, existing.Id);
        }

        return Result<CreateMeetingResultDto>.Success(new CreateMeetingResultDto(existing.Guid!.Value, existing.Number));
    }

    /// <summary>سمت باید روی دسته‌بندی مجوز داشته باشد؛ دسته‌ی هیئت مدیره «آزاد برای همه» نمی‌شود.</summary>
    private async Task<string?> ValidateCategoryAccessAsync(Guid categoryGuid, ActingIdentity identity)
    {
        var category = await categoryRepository.LoadAsync(categoryGuid);
        if (category == null) return "دسته‌بندی انتخاب‌شده یافت نشد.";

        var isBoard = MeetingKinds.IsBoard(categoryGuid);
        var allowedForPosition = identity.PositionGuid is { } position
                                 && await categoryPermissionRepository.HasAccessAsync(category.Id, position);

        if (isBoard)
            return allowedForPosition || identity.HasExplicitPermission(Permissions.BoardViewAll)
                ? null
                : "ثبت جلسه‌ی هیئت مدیره فقط برای سمت‌های مجاز امکان‌پذیر است.";

        return allowedForPosition || category.ViewAll || identity.IsSuperAdmin
            ? null
            : "سمت شما مجوز ثبت جلسه در این دسته‌بندی را ندارد.";
    }

    /// <summary>ویرایش جلسه (مسیر قدیمی؛ همان قوانین ثبت/ویرایش)</summary>
    public async Task<Result<bool>> Handle(EditMeetingDto command)
    {
        var result = await Handle((CreateMeetingDto)command);
        return result.IsSuccess
            ? Result<bool>.Success(true, "جلسه با موفقیت ویرایش شد")
            : Result<bool>.Failure(false, result.Message);
    }

    private async Task ProcessAgendaFiles(Meeting meeting, Guid currentUser, List<AgendaDto> agendaDtos)
    {
        foreach (var agendaDto in agendaDtos.Where(a => !a.IsRemoved))
        {
            var agenda = agendaDto.Id is > 0
                ? meeting.Agendas.FirstOrDefault(a => a.Id == agendaDto.Id.Value)
                : meeting.Agendas.FirstOrDefault(a => a.Text == agendaDto.Text);
            if (agenda == null) continue;

            foreach (var fileDto in agendaDto.Files ?? [])
            {
                if (fileDto.IsRemoved && fileDto.Id > 0)
                {
                    var existingFile = await fileRepository.LoadAsync(fileDto.Id);
                    if (existingFile != null && existingFile.Type == FileType.Agenda && existingFile.ModuleId == agenda.Id)
                        fileRepository.Delete(existingFile);
                }
                else if (!fileDto.IsRemoved && fileDto.Id == 0 && fileDto.FileGuid != null)
                {
                    await fileRepository.CreateAsync(new File(currentUser, agenda.Id, fileDto.FileGuid, FileType.Agenda));
                }
            }
        }

        await fileRepository.SaveChangesAsync();
    }

    // ═══════════════════════════════════════════════════════════
    // شرح جلسه
    // ═══════════════════════════════════════════════════════════
    public async Task<Result<bool>> Handle(MeetingDescriptionEditModel command)
    {
        var meeting = await repository.LoadAsync(command.Guid);
        if (meeting == null)
            return Result<bool>.Failure(false, "جلسه مورد نظر یافت نشد.");

        var check = await MeetingGuard.CheckAsync(accessService, meeting.Id, MeetingCapability.WriteMinutes);
        if (!check.Allowed) return check.Fail(false);
        if (!check.Access.IsContentEditable && !check.Access.IsSuperAdmin)
            return Result<bool>.Failure(false, MeetingAccess.LockedMessage);

        var identity = await identityResolver.ResolveAsync();
        meeting.EditDescription(identity.TokenUserGuid, command.Description ?? "");
        repository.Update(meeting);
        return Result<bool>.Success(true);
    }

    // ═══════════════════════════════════════════════════════════
    // تغییر وضعیت
    // ═══════════════════════════════════════════════════════════
    public async Task<Result<bool>> Handle(ChangeStatusModel command)
    {
        var meeting = await repository.LoadAsync(command.MeetingGuid, "MeetingMembers,Resolutions");
        if (meeting == null)
            return Result<bool>.Failure(false, "جلسه مورد نظر یافت نشد.");

        var access = await accessService.GetAsync(meeting.Id);
        var from = meeting.StatusId ?? 0;
        var to = command.StatusId;
        if (from == to) return Result<bool>.Success(true);

        var capability = to == MeetingStatusIds.Cancelled ? MeetingCapability.CancelMeeting : MeetingCapability.ChangeStatus;
        var isDraftRegistration = from == MeetingStatusIds.Draft && to == MeetingStatusIds.Registered && access.IsCreator;
        if (!access.Can(capability) && !isDraftRegistration)
            return Result<bool>.Failure(false, MeetingAccess.DeniedMessage(capability));

        if (!MeetingStatusIds.CanTransition(from, to) && !access.IsSuperAdmin)
            return Result<bool>.Failure(false, "انتقال جلسه به این وضعیت مجاز نیست.");

        var validation = ValidateTransition(meeting, access, from, to);
        if (validation is not null) return Result<bool>.Failure(false, validation);

        var identity = await identityResolver.ResolveAsync();
        meeting.ChangeStatus(identity.TokenUserGuid, to);
        repository.Update(meeting);

        switch (to)
        {
            case MeetingStatusIds.Registered when from == MeetingStatusIds.Draft:
                await PublishSafeAsync(NotificationEventCode.MeetingCreated, meeting.Id);
                break;
            case MeetingStatusIds.Cancelled:
                await PublishSafeAsync(NotificationEventCode.MeetingCanceled, meeting.Id);
                break;
            case MeetingStatusIds.Finalized when access.Workflow.HasMinutes:
                await PublishSafeAsync(NotificationEventCode.MinutesReadyForSignature, meeting.Id);
                break;
            case MeetingStatusIds.Completed:
                await PublishSafeAsync(NotificationEventCode.MeetingFinalized, meeting.Id);
                // جلسات بدون صورتجلسه (هیئت مدیره) با اتمام جلسه ابلاغ می‌شوند
                if (!access.Workflow.HasMinutes)
                    await assignmentPublication.NotifyMeetingAssignmentsAsync(meeting.Id, identity.UserGuid);
                break;
        }

        return Result<bool>.Success(true);
    }

    /// <returns>پیام خطا یا null</returns>
    private static string? ValidateTransition(Meeting meeting, MeetingAccess access, int from, int to)
    {
        var chairman = meeting.MeetingMembers.FirstOrDefault(m => m.RoleId == MeetingRoles.ChairmanId);

        switch (to)
        {
            case MeetingStatusIds.Held:
                if (meeting.Date is { } date && date.Date > DateTime.Today)
                    return $"تاریخ جلسه ({Assignment(date)}) هنوز فرا نرسیده است. امکان برگزاری جلسه وجود ندارد.";
                if (from == MeetingStatusIds.Finalized && chairman?.IsSign == true)
                    return "صورتجلسه توسط رئیس امضا شده و امکان بازگشت آن وجود ندارد.";
                break;

            case MeetingStatusIds.Finalized:
                if (!access.Workflow.HasMinutes)
                    return "این نوع جلسه مرحله‌ی ثبت نهایی ندارد.";
                if (!meeting.Resolutions.Any() && string.IsNullOrWhiteSpace(meeting.Description))
                    return "بدون شرح جلسه یا ثبت مصوبه امکان ثبت نهایی جلسه وجود ندارد.";
                if (meeting.MeetingMembers.Any(m => m.IsPresent == null && !MeetingRoles.Is(m.RoleId, MeetingRoleKey.Guest)))
                    return "بدون ثبت حضور و غیاب همه‌ی اعضا امکان ثبت نهایی جلسه وجود ندارد.";
                if (chairman != null && chairman.IsPresent == false && chairman.ReplacementUserGuid == null)
                    return "رئیس جلسه غایب است و جانشین ندارد.";
                break;

            case MeetingStatusIds.Completed:
                if (access.Workflow.HasMinutes)
                {
                    if (from != MeetingStatusIds.Finalized)
                        return "اتمام جلسه فقط پس از ثبت نهایی امکان‌پذیر است.";
                    if (chairman?.IsSign != true)
                        return "اتمام جلسه پس از امضای صورتجلسه توسط رئیس امکان‌پذیر است.";
                }
                break;
        }

        return null;

        static string Assignment(DateTime d) => Domain.AssignmentAgg.Assignment.ToShamsi(d);
    }

    // ═══════════════════════════════════════════════════════════
    // حذف جلسه
    // ═══════════════════════════════════════════════════════════
    public async Task<Result<bool>> Handle(DeleteMeetingDto command)
    {
        var meeting = await repository.LoadAsync(command.Guid);
        if (meeting == null)
            return Result<bool>.Failure(false, "جلسه مورد نظر یافت نشد.");

        var identity = await identityResolver.ResolveAsync();
        var access = await accessService.GetAsync(meeting.Id);
        if (!identity.HasPermission(Permissions.MeetingsDelete) || !(access.IsCreator || access.Can(MeetingCapability.EditMeeting)))
            return Result<bool>.Failure(false, "شما دسترسی حذف این جلسه را ندارید.");
        if (meeting.StatusId is not (MeetingStatusIds.Draft or MeetingStatusIds.Registered))
            return Result<bool>.Failure(false, "فقط جلسات پیش‌نویس یا ثبت اولیه قابل حذف هستند.");

        repository.Delete(meeting);
        return Result<bool>.Success(true);
    }

    // ═══════════════════════════════════════════════════════════
    // دستور جلسه (مسیر قدیمی تک‌دستوری)
    // ═══════════════════════════════════════════════════════════
    public async Task<Result<bool>> Handle(DeleteAgendaDto command)
    {
        var meeting = await repository.LoadAsync(command.Guid, "Agendas");
        if (meeting == null)
            return Result<bool>.Failure(false, "جلسه مورد نظر یافت نشد");

        var check = await MeetingGuard.CheckAsync(accessService, meeting.Id, MeetingCapability.ManageAgenda);
        if (!check.Allowed) return check.Fail(false);

        meeting.Agendas.Clear();
        repository.Update(meeting);
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> Handle(CreateOrEditAgendaModel command)
    {
        var meeting = await repository.LoadAsync(command.MeetingGuid, "Agendas");
        if (meeting == null)
            return Result<bool>.Failure(false, "جلسه مورد نظر یافت نشد");

        var check = await MeetingGuard.CheckAsync(accessService, meeting.Id, MeetingCapability.ManageAgenda);
        if (!check.Allowed) return check.Fail(false);

        var identity = await identityResolver.ResolveAsync();
        var agenda = meeting.Agendas.FirstOrDefault();
        if (agenda == null)
            meeting.Agendas.Add(new Agenda(identity.TokenUserGuid, new AgendaDto { File = command.FileGuid, Text = command.Text }, meeting.Id));
        else
            agenda.Edit(new AgendaDto { File = command.FileGuid, Text = command.Text });

        repository.Update(meeting);
        return Result<bool>.Success(true);
    }

    // ═══════════════════════════════════════════════════════════
    // پیوست‌ها و الحاقیه
    // ═══════════════════════════════════════════════════════════
    public async Task<Result<bool>> Handle(MeetingAttachmentDto command)
    {
        var check = await MeetingGuard.CheckAsync(accessService, command.MeetingGuid, MeetingCapability.UploadFiles);
        if (!check.Allowed) return check.Fail(false);

        var identity = await identityResolver.ResolveAsync();
        foreach (var fileGuid in command.Files.Where(g => g != Guid.Empty).Distinct())
            await fileRepository.CreateAsync(new File(identity.TokenUserGuid, check.Access.MeetingId, fileGuid, FileType.Meeting));

        return Result<bool>.Success(true);
    }

    public async Task<Result<UpdateRiderResultDto>> Handle(MeetingRiderDto command)
    {
        var meeting = await repository.LoadAsync(command.MeetingGuid);
        if (meeting == null)
            return Result<UpdateRiderResultDto>.Failure(new UpdateRiderResultDto(), "جلسه مورد نظر یافت نشد.");

        var check = await MeetingGuard.CheckAsync(accessService, meeting.Id, MeetingCapability.EditMeeting);
        if (!check.Allowed) return check.Fail(new UpdateRiderResultDto());

        // فایل ترجیحاً با tus در سامانه مدیریت فایل آپلود و فقط شناسه‌اش ارسال می‌شود (فایل‌های بزرگ)
        var fileGuid = command.RiderGuid is { } uploaded && uploaded != Guid.Empty ? uploaded : meeting.RiderGuid;
        if (command.File != null)
        {
            var token = httpContextAccessor.HttpContext?.Request.Headers["Authorization"].FirstOrDefault();
            var path = meeting.Number + "{{Folder}}الحاقیه";
            var upload = await command.File.UploadFileAsync(ClientId, path, token, configuration);
            if (!upload.IsSuccess)
                return Result<UpdateRiderResultDto>.Failure(new UpdateRiderResultDto(), "بارگذاری فایل الحاقیه ناموفق بود.");
            fileGuid = upload.Data;
        }

        var identity = await identityResolver.ResolveAsync();
        meeting.EditRider(identity.TokenUserGuid, command.Rider ?? "", fileGuid);
        repository.Update(meeting);
        return Result<UpdateRiderResultDto>.Success(new UpdateRiderResultDto { RiderGuid = fileGuid });
    }

    public async Task<Result<bool>> Handle(DeleteRiderFileGuid command)
    {
        var meeting = await repository.LoadAsync(command.Guid);
        if (meeting == null) return Result<bool>.Failure(false, "جلسه مورد نظر یافت نشد");

        var check = await MeetingGuard.CheckAsync(accessService, meeting.Id, MeetingCapability.EditMeeting);
        if (!check.Allowed) return check.Fail(false);
        if (meeting.RiderGuid == null)
            return Result<bool>.Failure(false, "الحاقیه مورد نظر دارای فایل نمی باشد");

        var token = httpContextAccessor.HttpContext?.Request.Headers["Authorization"].FirstOrDefault();
        var result = await meeting.RiderGuid.Value.DeleteFileAsync(token, configuration);
        if (!result.IsSuccess)
            return Result<bool>.Failure(false, "متاسفانه خطایی در حذف فایل رخ داد");

        meeting.RiderGuid = null;
        repository.Update(meeting);
        return Result<bool>.Success(true, " عملیات با موفقیت انجام شد");
    }

    // ═══════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════
    private async Task PublishSafeAsync(NotificationEventCode code, long meetingId)
    {
        try
        {
            var identity = await identityResolver.ResolveAsync();
            await notificationPublisher.PublishAsync(code, new NotificationPayload
            {
                MeetingId = meetingId,
                ActorUserGuid = identity.UserGuid,
            });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Publishing {Code} failed for meeting {MeetingId}", code, meetingId);
        }
    }
}
