using Epc.Application.Command;
using Epc.Company.Query;
using Epc.Identity;
using MeetingManagement.Application.Contracts.Agenda;
using MeetingManagement.Application.Contracts.Meeting;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.AlarmAgg;
using MeetingManagement.Domain.BoardMemberAgg;
using MeetingManagement.Domain.CategoryAgg;
using MeetingManagement.Domain.FileAgg;
using MeetingManagement.Domain.MeetingAgg;
using MeetingManagement.Domain.MeetingAgg.Service;
using MeetingManagement.Domain.NotificationEventAgg;
using MeetingManagement.Domain.NotificationSettingAgg;
using MeetingManagement.Domain.NotificationTemplateAgg;
using MeetingManagement.Domain.RoomAgg;
using MeetingManagement.Domain.Shared.Acls.UserManagement;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Newtonsoft.Json.Linq;
using File = MeetingManagement.Domain.FileAgg.File;
using MeetingManagement.Domain.Shared.Access;
using MeetingManagement.Domain.Shared.Notifications;
using Microsoft.Extensions.Logging;

namespace MeetingManagement.Application;

public class MeetingCommandHandler(
    IMeetingRepository repository,
    IClaimHelper claimHelper,
    IMeetingService meetingService,
    IRoomRepository roomRepository,
    IMeetingMemberRepository meetingMemberRepository,
    ICategoryRepository categoryRepository,
    INotificationEventRepository notificationEventRepository,
    INotificationTemplateRepository notificationTemplateRepository,
    IBoardMemberRepository boardMemberRepository,
    INotificationSettingRepository notificationSettingRepository,
    IAlarmRepository alarmRepository,
    IFileRepository fileRepository,
    IHttpContextAccessor httpContextAccessor,
    IUserManagementAclService userManagementAclService,
    IConfiguration configuration,
    IMeetingAccessService accessService,
    INotificationPublisher notificationPublisher,
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
        ICommandHandlerAsync<DeleteRiderFileGuid,Result<bool>>
{
    /// <summary>
    /// ثبت جلسه
    /// </summary>
    /// <param name="command"></param>
    /// <returns></returns>
    public async Task<Result<CreateMeetingResultDto>> Handle(CreateMeetingDto command)
    {
        var currentUser = claimHelper.GetCurrentUserGuid();
        var meeting = new Meeting();
        if (command.Guid == null)
        {
            // ═══════════════════════════════════════════════════════════
            // ثبت جلسه جدید
            // ═══════════════════════════════════════════════════════════
            var clientIdHeader = httpContextAccessor.HttpContext?.Request.Headers["client-id"].ToString();
            meeting = new Meeting(currentUser, command, meetingService, repository, roomRepository, categoryRepository);

            // اضافه کردن دستور جلسات (بدون فایل)
            meetingService.AddAgendas(meeting, currentUser, clientIdHeader, command.Agendas);

            // اضافه کردن اعضا
            await meetingService.AddMembers(meeting, currentUser, clientIdHeader, command.Members);

            await repository.CreateAsync(meeting);
            await repository.SaveChangesAsync();

            // ✅ اضافه کردن فایل‌های دستور جلسات (بعد از SaveChanges)
            await ProcessAgendaFiles(meeting, currentUser, command.Agendas);

            // ✅ اطلاع‌رسانی از طریق صف (Outbox): خطای پنل پیامک دیگر ثبت جلسه را خراب نمی‌کند
            // (قبلاً NullReference روی setting و ارسال هم‌زمان پیامک باعث خطای 500 پس از ذخیره و ثبت تکراری می‌شد)
            if (command.SendNotification)
                await PublishSafeAsync(NotificationEventCode.MeetingCreated, meeting.Id);

        }
        else
        {
            var clientIdHeader = httpContextAccessor.HttpContext?.Request.Headers["client-id"].ToString();
            meeting = await repository.LoadAsync(command.Guid.Value, "Agendas,MeetingMembers");

            if (meeting == null)
                return Result<CreateMeetingResultDto>.Failure(null, "جلسه مورد نظر یافت نشد");

            var editAccess = await accessService.GetAsync(meeting.Id);
            if (!editAccess.Can(MeetingCapability.EditMeeting) && !editAccess.IsCreator)
                return Result<CreateMeetingResultDto>.Failure(null, MeetingAccess.DeniedMessage(MeetingCapability.EditMeeting));

            var previousStatus = meeting.StatusId;
            var previousSchedule = (meeting.Date, meeting.StartTime, meeting.EndTime, meeting.RoomId, meeting.RoomName, meeting.RoomLink);

            meeting.Edit(currentUser, command, meetingService, repository, roomRepository, categoryRepository);
            meetingService.AddAgendas(meeting, currentUser, clientIdHeader, command.Agendas);
            await meetingService.AddMembers(meeting, currentUser, clientIdHeader, command.Members);

            var scheduleChanged = previousSchedule != (meeting.Date, meeting.StartTime, meeting.EndTime, meeting.RoomId, meeting.RoomName, meeting.RoomLink);

            repository.Update(meeting);
            await repository.SaveChangesAsync();

            // ✅ پردازش فایل‌های دستور جلسات
            await ProcessAgendaFiles(meeting, currentUser, command.Agendas);
            if (command.SendNotification)
            {
                var code = previousStatus == MeetingStatusIds.Draft
                    ? NotificationEventCode.MeetingCreated
                    : scheduleChanged ? NotificationEventCode.MeetingRescheduled : (NotificationEventCode?)null;
                if (code is not null) await PublishSafeAsync(code.Value, meeting.Id);
            }
        }

        return Result<CreateMeetingResultDto>.Success(new CreateMeetingResultDto(meeting.Guid.Value, meeting.Number));

    }
    private async Task ProcessAgendaFiles(Meeting meeting, Guid currentUser, List<AgendaDto> agendaDtos)
    {
        foreach (var agendaDto in agendaDtos.Where(a => !a.IsRemoved))
        {
            // پیدا کردن Agenda مربوطه
            Agenda? agenda = null;

            if (agendaDto.Id.HasValue && agendaDto.Id.Value > 0)
            {
                agenda = meeting.Agendas.FirstOrDefault(a => a.Id == agendaDto.Id.Value);
            }
            else
            {
                // برای دستور جلسات جدید، بر اساس متن پیدا کن
                agenda = meeting.Agendas.FirstOrDefault(a => a.Text == agendaDto.Text);
            }

            if (agenda == null) continue;

            // پردازش فایل‌ها
            foreach (var fileDto in agendaDto.Files ?? new List<FileDto>())
            {
                if (fileDto.IsRemoved && fileDto.Id > 0)
                {
                    // ✅ حذف فایل
                    var existingFile = await fileRepository.LoadAsync(fileDto.Id);
                    if (existingFile != null && existingFile.Type == FileType.Agenda)
                    {
                        fileRepository.Delete(existingFile);
                    }
                }
                else if (!fileDto.IsRemoved && fileDto.Id == 0 && fileDto.FileGuid!=null)
                {
                    // ✅ افزودن فایل جدید
                    var newFile = new Domain.FileAgg.File(currentUser, agenda.Id, fileDto.FileGuid, FileType.Agenda);
                    await fileRepository.CreateAsync(newFile);
                }
                // فایل‌هایی که Id > 0 و IsRemoved = false هستند، نیاز به کاری ندارند
            }
        }

        await fileRepository.SaveChangesAsync();
    }
    /// <summary>
    /// ذخیره سازی شرح جلسه
    /// </summary>
    /// <param name="command"></param>
    /// <returns></returns>
    public async Task<Result<bool>> Handle(MeetingDescriptionEditModel command)
    {
        var currentUser = claimHelper.GetCurrentUserGuid();
        var meeting = await repository.LoadAsync(command.Guid);
        if (meeting == null)
            return Result<bool>.Failure(false, "جلسه مورد نظر یافت نشد.");

        meeting.EditDescription(currentUser, command.Description ?? "");
        repository.Update(meeting);
        return Result<bool>.Success(true);
    }
    /// <summary>
    /// تغییر وضعیت جلسه
    /// </summary>
    /// <param name="command"></param>
    /// <returns></returns>
    public async Task<Result<bool>> Handle(ChangeStatusModel command)
    {
        var currentUser = claimHelper.GetCurrentUserGuid();
        var meeting = await repository.LoadAsync(command.MeetingGuid, "MeetingMembers");

        if (meeting == null)
            return Result<bool>.Failure(false, "جلسه مورد نظر یافت نشد.");

        // ✅ کنترل دسترسی سمت سرور (قبلاً هر کاربری می‌توانست وضعیت هر جلسه‌ای را تغییر دهد)
        var access = await accessService.GetAsync(meeting.Id);
        if (!access.Can(MeetingCapability.ChangeStatus))
            return Result<bool>.Failure(false, MeetingAccess.DeniedMessage(MeetingCapability.ChangeStatus));

        // ✅ بررسی برگزاری جلسه (status = 3)
        if (command.StatusId == MeetingStatusIds.Held)
        {
            var validationResult = ValidateHoldMeeting(meeting);
            if (!validationResult.IsSuccess)
                return validationResult;
        }

        // ✅ بررسی ثبت نهایی جلسه (status = 4)
        if (command.StatusId == MeetingStatusIds.Finalized)
        {
            var validationResult = ValidateFinalizeRegistration(meeting);
            if (!validationResult.IsSuccess)
                return validationResult;
        }

        meeting.ChangeStatus(currentUser, command.StatusId);
        repository.Update(meeting);

        if (command.StatusId == MeetingStatusIds.Finalized && access.Workflow.HasMinutes)
            await PublishSafeAsync(NotificationEventCode.MinutesReadyForSignature, meeting.Id);
        else if (command.StatusId == MeetingStatusIds.Completed)
            await PublishSafeAsync(NotificationEventCode.MeetingFinalized, meeting.Id);

        return Result<bool>.Success(true);
    }

    private async Task PublishSafeAsync(NotificationEventCode code, long meetingId)
    {
        try
        {
            await notificationPublisher.PublishAsync(code, new NotificationPayload
            {
                MeetingId = meetingId,
                ActorUserGuid = claimHelper.GetCurrentUserGuid(),
            });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Publishing {Code} failed for meeting {MeetingId}", code, meetingId);
        }
    }

    /// <summary>
    /// بررسی امکان برگزاری جلسه - تاریخ جلسه باید رسیده باشد
    /// </summary>
    private Result<bool> ValidateHoldMeeting(Meeting meeting)
    {
        var meetingDate = meeting.Date.Value.Date;
        var today = DateTime.Today.Date;


        if (meetingDate > today)
        {
            return Result<bool>.Failure(false,
                $"تاریخ جلسه ({meeting.Date.Value.ToString("yyyy/MM/dd")}) هنوز فرا نرسیده است. امکان برگزاری جلسه وجود ندارد.");
        }

        return Result<bool>.Success(true);
    }

    /// <summary>
    /// بررسی امکان ثبت نهایی - رئیس و دبیر غایب نباید بدون جانشین باشند
    /// </summary>
    private Result<bool> ValidateFinalizeRegistration(Meeting meeting)
    {
        var members = meeting.MeetingMembers;

        if (members == null || !members.Any())
            return Result<bool>.Failure(false, "اطلاعات اعضای جلسه یافت نشد.");

        var errors = new List<string>();

        // بررسی رئیس جلسه (RoleId = 3)
        var chairman = members.FirstOrDefault(m => m.RoleId == MeetingRoles.ChairmanId);
        if (chairman != null)
        {
            var isAbsent = chairman.IsPresent == false;
           // var hasSubstitute =  meetingMemberRepository.Exists(c => c.ReplacementUserGuid == chairman.UserGuid && c.MeetingId == meeting.Id);

            var hasSubstitute = !string.IsNullOrEmpty(chairman.ReplacementUserGuid?.ToString());

            if (isAbsent && !hasSubstitute)
            {
                errors.Add("رئیس جلسه غایب است و جانشین ندارد");
            }
        }

        // بررسی دبیر جلسه (RoleId = 1) - دبیر غیرعضو (RoleId = 2) حساب نمی‌شود
        var secretary = members.FirstOrDefault(m => m.RoleId == MeetingRoles.SecretaryId);
        if (secretary != null)
        {
            var isAbsent = secretary.IsPresent == false;
          //  var hasSubstitute = meetingMemberRepository.Exists(c => c.ReplacementUserGuid == secretary.UserGuid && c.MeetingId == meeting.Id);

            var hasSubstitute = !string.IsNullOrEmpty(secretary.ReplacementUserGuid?.ToString());

            if (isAbsent && !hasSubstitute)
            {
                errors.Add("دبیر جلسه غایب است و جانشین ندارد");
            }
        }

        if (errors.Any())
        {
            return Result<bool>.Failure(false, string.Join(" | ", errors));
        }

        return Result<bool>.Success(true);
    }

    /// <summary>
    /// حذف جلسه
    /// </summary>
    /// <param name="command"></param>
    /// <returns></returns>

    public async Task<Result<bool>> Handle(DeleteMeetingDto command)
    {
        var meeting = await repository.LoadAsync(command.Guid);
        if (meeting == null)
            return Result<bool>.Failure(false, "جلسه مورد نظر یافت نشد.");

        repository.Delete(meeting);
        return Result<bool>.Success(true);
    }
    /// <summary>
    /// حذف دستور جلسه
    /// </summary>
    /// <param name="command"></param>
    /// <returns></returns>
    public async Task<Result<bool>> Handle(DeleteAgendaDto command)
    {
        var meeting = await repository.LoadAsync(command.Guid, "Agendas");
        if (meeting == null)
            return Result<bool>.Failure(false, "جلسه مورد نظر یافت نشد");
        meeting.Agendas.Clear();
        repository.Update(meeting);
        return Result<bool>.Success(true);
    }
    /// <summary>
    /// ثبت وویرایش دستور جلسه
    /// </summary>
    /// <param name="command"></param>
    /// <returns></returns>
    public async Task<Result<bool>> Handle(CreateOrEditAgendaModel command)
    {
        var currentUserGuid = claimHelper.GetCurrentUserGuid();
        var meeting = await repository.LoadAsync(command.MeetingGuid, "Agendas");
        if (meeting == null)
            return Result<bool>.Failure(false, "جلسه مورد نظر یافت نشد");
        var agenda = meeting.Agendas.FirstOrDefault();
        if (agenda == null)
        {
            agenda = new Agenda(currentUserGuid, new AgendaDto()
            {
                File = command.FileGuid,
                Text = command.Text,

            }, meeting.Id);
            meeting.Agendas.Add(agenda);
        }
        else
        {
            agenda.Edit(new AgendaDto()
            {
                File = command.FileGuid,
                Text = command.Text,
            });
            //todo:add file
        }

        repository.Update(meeting);
        return Result<bool>.Success(true);
    }
    /// <summary>
    /// ویرایش جلسه عدم استفاده
    /// </summary>
    /// <param name="command"></param>
    /// <returns></returns>
    public async Task<Result<bool>> Handle(EditMeetingDto command)
    {
        var currentUser = claimHelper.GetCurrentUserGuid();
        var meeting = await repository.LoadAsync(command.Guid);
        if (meeting == null)
            return Result<bool>.Failure(false, "جلسه مورد نظر یافت نشد");
        var clientIdHeader = httpContextAccessor.HttpContext?.Request.Headers["ClientId"].ToString();
        meeting.Edit(currentUser, command, meetingService, repository, roomRepository, categoryRepository);
        meetingService.AddAgendas(meeting, currentUser, clientIdHeader, command.Agendas);
        await meetingService.AddMembers(meeting, currentUser, clientIdHeader, command.Members);
        repository.Update(meeting);
        return Result<bool>.Success(true, "جلسه با موفقیت ویرایش شد");
    }
    /// <summary>
    /// ثبت پیوست های جلسه
    /// </summary>
    /// <param name="command"></param>
    /// <returns></returns>
    public async Task<Result<bool>> Handle(MeetingAttachmentDto command)
    {
        var currentUserGuid = claimHelper.GetCurrentUserGuid();
        var meetingId = await repository.GetIdByAsync(command.MeetingGuid);
        foreach (var item in command.Files)
        {
            await fileRepository.CreateAsync(new File(currentUserGuid, meetingId, item, FileType.Meeting));
        }
        return Result<bool>.Success(true);
    }

    public async Task<Result<UpdateRiderResultDto>> Handle(MeetingRiderDto command)
    {
        var currentUser = claimHelper.GetCurrentUserGuid();
        var meeting = await repository.LoadAsync(command.MeetingGuid);
        if (meeting == null)
            return Result<UpdateRiderResultDto>.Failure(new UpdateRiderResultDto(), "جلسه مورد نظر یافت نشد.");
        Guid? fileGuid = Guid.Empty;
        if (command.File != null)
        {
            var clientIdHeader = httpContextAccessor.HttpContext?.Request.Headers["client-id"].ToString();
            var token = httpContextAccessor.HttpContext?.Request.Headers["Authorization"].FirstOrDefault();
            var path = meeting.Number + "{{Folder}}الحاقیه";
            fileGuid =(await command.File.UploadFileAsync(clientIdHeader, path, token, configuration)).Data;
        }
        meeting.EditRider(currentUser, command.Rider ?? "", fileGuid);
        repository.Update(meeting);
        return Result<UpdateRiderResultDto>.Success(new UpdateRiderResultDto(){RiderGuid = fileGuid});
    }

    public async Task<Result<bool>> Handle(DeleteRiderFileGuid command)
    {
        var meeting = await repository.LoadAsync(command.Guid);
        if (meeting == null) return Result<bool>.Failure(false, "جلسه مورد نظر یافت نشد");
        var token = httpContextAccessor.HttpContext?.Request.Headers["Authorization"].FirstOrDefault();
        if (meeting.RiderGuid == null)
            return new Result<bool>(false, false,"الحاقیه مورد نظر دارای فایل نمی باشد");
        var result = await meeting.RiderGuid?.DeleteFileAsync(token, configuration);
        if (result.IsSuccess)
        {
            meeting.RiderGuid = null;
            repository.Update(meeting);
        }

        return new Result<bool>(result.IsSuccess, result.IsSuccess, result.IsSuccess ? " عملیات با موفقیت انجام شد" : "متاسفانه خطایی در انجام عملیات رخ داد");
    }
    public string ApplyTemplate(string templateContent, Dictionary<string, string> parameters)
    {
        return parameters.Aggregate(templateContent, (current, param) => current.Replace($"[{param.Key}]", param.Value));
    }
}
