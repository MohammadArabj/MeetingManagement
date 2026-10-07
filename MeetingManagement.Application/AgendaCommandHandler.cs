using Epc.Application.Command;
using Epc.Company.Query;
using Epc.Identity;
using MeetingManagement.Application.Contracts.Agenda;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.FileAgg;
using MeetingManagement.Domain.MeetingAgg;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace MeetingManagement.Application;

public class AgendaCommandHandler(IAgendaRepository repository, IMeetingRepository meetingRepository, IFileRepository fileRepository, IClaimHelper claimHelper, IHttpContextAccessor httpContextAccessor, IConfiguration configuration) :
    ICommandHandlerAsync<AgendaDto, Result<long>>,
    ICommandHandlerAsync<DeleteAgenda, Result<bool>>,
    ICommandHandlerAsync<UpdateAgendaOrderRequest, Result<bool>>,
    ICommandHandlerAsync<DeleteAgendaFileDto, Result<Guid?>>
{
    public async Task<Result<long>> Handle(AgendaDto command)
    {
        var currentUserId = claimHelper.GetCurrentUserGuid();
        var meeting = await meetingRepository.LoadAsync(command.MeetingGuid);

        if (meeting == null)
            return Result<long>.Failure(0, "جلسه مورد نظر یافت نشد");

        if (command.Id != 0)
        {
            // ═══════════════════════════════════════════════════════════
            // حالت ویرایش
            // ═══════════════════════════════════════════════════════════
            var agenda = await repository.LoadAsync(command.Id.Value);

            // 1️⃣ حذف فایل‌هایی که isRemoved = true هستند
            var filesToRemove = command.Files
                .Where(f => f.IsRemoved && f.Id != 0)
                .Select(f => f.Id)
                .ToList();

            if (filesToRemove.Any())
            {
                var existingFiles = await fileRepository
                    .FilterAsync(f => filesToRemove.Contains(f.Id) && f.Type == FileType.Agenda);

                foreach (var file in existingFiles)
                {
                    fileRepository.Delete(file);
                }
            }

            // 2️⃣ افزودن فایل‌های جدید (Id = 0 و isRemoved = false)
            var newFiles = command.Files
                .Where(f => f.Id == 0 && !f.IsRemoved)
                .ToList();

            foreach (var item in newFiles)
            {
                var file = new Domain.FileAgg.File(currentUserId, agenda.Id, item.FileGuid, FileType.Agenda);
                await fileRepository.CreateAsync(file);
            }

            // 3️⃣ فایل‌هایی که Id != 0 و isRemoved = false هستند → کاری نداریم

            agenda.Edit(command);
            repository.Update(agenda);

            return Result<long>.Success(agenda.Id);
        }
        else
        {
            // ═══════════════════════════════════════════════════════════
            // حالت ثبت جدید
            // ═══════════════════════════════════════════════════════════
            var lastSortOrder = (await repository.FilterAsync(r => r.MeetingId == meeting.Id))
                .OrderByDescending(r => r.SortOrder)
                .Select(r => r.SortOrder)
                .FirstOrDefault();

            var last = lastSortOrder == null ? 1 : lastSortOrder + 1;
            command.Order = (byte)last;

            var agenda = new Agenda(currentUserId, command, meeting.Id);
            await repository.CreateAsync(agenda);
            await repository.SaveChangesAsync();

            // همه فایل‌ها جدید هستند (isRemoved = false)
            var newFiles = command.Files.Where(f => !f.IsRemoved).ToList();

            foreach (var item in newFiles)
            {
                var file = new Domain.FileAgg.File(currentUserId, agenda.Id, item.FileGuid, FileType.Agenda);
                await fileRepository.CreateAsync(file);
            }

            return Result<long>.Success(agenda.Id);
        }
    }
    private async Task ManageFilesAsync(List<FileDto> files, long agendaId, Guid currentUserId)
    {
        // 1. ابتدا فایل‌هایی که IsRemoved = true را حذف می‌کنیم
        var filesToRemove = files.Where(f => f.IsRemoved && f.Id != 0).ToList();
        foreach (var fileDto in filesToRemove)
        {
            var file = await fileRepository.LoadAsync(fileDto.Id);
            if (file != null)
            {
                fileRepository.Delete(file);
            }
        }

        // 2. فایل‌های جدید (Id = 0 و IsRemoved = false) را اضافه می‌کنیم
        var newFiles = files.Where(f => f.Id == 0 && !f.IsRemoved).ToList();
        foreach (var fileDto in newFiles)
        {
            var file = new Domain.FileAgg.File(currentUserId, agendaId, fileDto.FileGuid, FileType.Agenda);
            await fileRepository.CreateAsync(file);
        }

        // 3. فایل‌هایی که Id != 0 و IsRemoved = false هستند، کاری با آنها نداریم
        // این فایل‌ها از قبل در دیتابیس وجود دارند و تغییری نکرده‌اند

        await fileRepository.SaveChangesAsync();
    }
    public async Task<Result<bool>> Handle(DeleteAgenda command)
    {
        var meetingMember = await repository.LoadAsync(command.Id);

        if (meetingMember != null)
        {
            repository.Delete(meetingMember);
            return Result<bool>.Success(true);
        }

        return Result<bool>.Failure(false, "دستور جلسه یافت نشد");
    }

    public async Task<Result<bool>> Handle(UpdateAgendaOrderRequest command)
    {
        var resolutionIds = command.Agendas.Select(r => r.Id).ToList();
        var resolutions = (await repository.FilterAsync(c => resolutionIds.Contains(c.Id))).ToList();

        foreach (var res in resolutions)
        {
            var newOrder = command.Agendas.FirstOrDefault(r => r.Id == res.Id)?.SortOrder;
            if (newOrder.HasValue)
            {
                res.SortOrder = newOrder.Value;
            }
        }

        await repository.SaveChangesAsync();
        return Result<bool>.Success(true);
    }

    public async Task<Result<Guid?>> Handle(DeleteAgendaFileDto command)
    {
        var agenda = await repository.LoadAsync(command.Id);
        var token = httpContextAccessor.HttpContext.Request.Headers["Authorization"].ToString();
        if (agenda == null) return Result<Guid?>.Failure(null, "دستور یافت نشد");
        var fileGuid = agenda.File;
        agenda.File = null;
        repository.Update(agenda);
        return Result<Guid?>.Success(fileGuid);
    }
}