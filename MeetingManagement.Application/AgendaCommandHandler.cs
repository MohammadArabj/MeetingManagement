using Epc.Application.Command;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Agenda;
using MeetingManagement.Application.Services;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.FileAgg;
using MeetingManagement.Domain.MeetingAgg;
using MeetingManagement.Domain.Shared.Access;

namespace MeetingManagement.Application;

/// <summary>
/// دستور جلسه و فایل‌های آن. همه‌ی عملیات نیازمند توانایی «مدیریت دستور جلسه» در همان جلسه است
/// و هر شناسه‌ی ارسالی (دستور/فایل) باید متعلق به همان جلسه باشد.
/// </summary>
public class AgendaCommandHandler(
    IAgendaRepository repository,
    IMeetingRepository meetingRepository,
    IFileRepository fileRepository,
    IMeetingAccessService accessService,
    IActingIdentityResolver identityResolver) :
    ICommandHandlerAsync<AgendaDto, Result<long>>,
    ICommandHandlerAsync<DeleteAgenda, Result<bool>>,
    ICommandHandlerAsync<UpdateAgendaOrderRequest, Result<bool>>,
    ICommandHandlerAsync<DeleteAgendaFileDto, Result<Guid?>>
{
    public async Task<Result<long>> Handle(AgendaDto command)
    {
        var check = await MeetingGuard.CheckAsync(accessService, command.MeetingGuid, MeetingCapability.ManageAgenda);
        if (!check.Allowed) return check.Fail(0L);

        if (string.IsNullOrWhiteSpace(command.Text))
            return Result<long>.Failure(0, "متن دستور جلسه الزامی است.");

        var identity = await identityResolver.ResolveAsync();
        var meetingId = check.Access.MeetingId;
        var files = command.Files ?? [];

        if (command.Id is > 0)
        {
            var agenda = await repository.LoadAsync(command.Id.Value);
            if (agenda == null || agenda.MeetingId != meetingId)
                return Result<long>.Failure(0, "دستور جلسه یافت نشد.");

            var removeIds = files.Where(f => f.IsRemoved && f.Id != 0).Select(f => f.Id).ToList();
            if (removeIds.Count > 0)
            {
                var existingFiles = await fileRepository.FilterAsync(f =>
                    removeIds.Contains(f.Id) && f.Type == FileType.Agenda && f.ModuleId == agenda.Id);
                foreach (var file in existingFiles) fileRepository.Delete(file!);
            }

            foreach (var item in files.Where(f => f.Id == 0 && !f.IsRemoved && f.FileGuid != Guid.Empty))
                await fileRepository.CreateAsync(new Domain.FileAgg.File(identity.TokenUserGuid, agenda.Id, item.FileGuid, FileType.Agenda));

            agenda.Edit(command);
            repository.Update(agenda);
            return Result<long>.Success(agenda.Id);
        }

        var lastSortOrder = (await repository.FilterAsync(r => r.MeetingId == meetingId))
            .Select(r => (int?)r!.SortOrder)
            .Max() ?? 0;
        command.Order = (byte)Math.Min(lastSortOrder + 1, byte.MaxValue);

        var created = new Agenda(identity.TokenUserGuid, command, meetingId);
        await repository.CreateAsync(created);
        await repository.SaveChangesAsync();

        foreach (var item in files.Where(f => !f.IsRemoved && f.FileGuid != Guid.Empty))
            await fileRepository.CreateAsync(new Domain.FileAgg.File(identity.TokenUserGuid, created.Id, item.FileGuid, FileType.Agenda));

        return Result<long>.Success(created.Id);
    }

    public async Task<Result<bool>> Handle(DeleteAgenda command)
    {
        var agenda = await repository.LoadAsync(command.Id);
        if (agenda == null)
            return Result<bool>.Failure(false, "دستور جلسه یافت نشد");

        var check = await MeetingGuard.CheckAsync(accessService, agenda.MeetingId ?? 0, MeetingCapability.ManageAgenda);
        if (!check.Allowed) return check.Fail(false);

        repository.Delete(agenda);
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> Handle(UpdateAgendaOrderRequest command)
    {
        if (command.Agendas.Count == 0) return Result<bool>.Success(true);

        var ids = command.Agendas.Select(r => r.Id).ToList();
        var agendas = (await repository.FilterAsync(c => ids.Contains(c.Id))).ToList();
        var meetingIds = agendas.Select(a => a!.MeetingId).Distinct().ToList();
        if (meetingIds.Count != 1)
            return Result<bool>.Failure(false, "دستورهای انتخاب‌شده متعلق به یک جلسه نیستند.");

        var check = await MeetingGuard.CheckAsync(accessService, meetingIds[0] ?? 0, MeetingCapability.ManageAgenda);
        if (!check.Allowed) return check.Fail(false);

        foreach (var agenda in agendas)
        {
            var newOrder = command.Agendas.FirstOrDefault(r => r.Id == agenda!.Id)?.SortOrder;
            if (newOrder.HasValue) agenda!.SortOrder = newOrder.Value;
        }

        await repository.SaveChangesAsync();
        return Result<bool>.Success(true);
    }

    public async Task<Result<Guid?>> Handle(DeleteAgendaFileDto command)
    {
        var agenda = await repository.LoadAsync(command.Id);
        if (agenda == null) return Result<Guid?>.Failure(null, "دستور یافت نشد");

        var check = await MeetingGuard.CheckAsync(accessService, agenda.MeetingId ?? 0, MeetingCapability.ManageAgenda);
        if (!check.Allowed) return check.Fail<Guid?>(null);

        var fileGuid = agenda.File;
        agenda.File = null;
        repository.Update(agenda);
        return Result<Guid?>.Success(fileGuid);
    }
}
