using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Epc.Application.Command;
using Epc.Application.FileValidation;
using Epc.Company.Query;
using Epc.Identity;
using FileManagement.Application.Contract.Attachment;
using FileManagement.Application.Contracts.Attachment;
using FileManagement.Domain.AttachmentAgg;
using FileManagement.Domain.AttachmentAgg.Service;
using FileManagement.Domain.ClassificationAgg;
using FileManagement.Domain.ClassificationAgg.Service;
using FileManagement.Domain.Shared.Acls.UserManagement;
using FileManagement.Common;
using FileSignatures;

namespace FileManagement.Application;

public class AttachmentCommandHandler(
    IAttachmentRepository attachmentRepository,
    IClaimHelper claimHelper,
    IAttachmentService attachmentService,
    IFileService fileService,
    IClassificationRepository classificationRepository,
    IUserManagementAclService userManagementAclService,
    IClassificationService classificationService,
    FileStorageLocations storageLocations,
    Microsoft.AspNetCore.Http.IHttpContextAccessor httpContextAccessor)
    :
        ICommandHandlerAsync<CreateAttachment, Guid>,
        ICommandHandlerAsync<EditAttachment>,
        ICommandHandlerAsync<UploadFileModel, UploadResult>,
        ICommandHandlerAsync<UploadFileList, List<UploadResult>>,
        ICommandHandlerAsync<DeleteAttachmentGuidDto, Result<bool>>,
        ICommandHandlerAsync<DeleteAttachmentGuidsDto, Result<BulkDeleteAttachmentsResult>>
{
    public Task<Guid> Handle(CreateAttachment command)
        => throw new NotImplementedException();

    public async Task Handle(EditAttachment command)
    {
        var attachment = await attachmentRepository.LoadAsync(command.Guid);
        attachment.Edit(command.ClassificationId, command.Description, attachmentService);
        attachmentRepository.Update(attachment);
    }


    public Task<UploadResult> Handle(UploadFileModel command)
        => throw new NotImplementedException();

    public Task<List<UploadResult>> Handle(UploadFileList command)
        => throw new NotImplementedException();

    // -----------------------------
    // حذف تکی
    // -----------------------------
    public async Task<Result<bool>> Handle(DeleteAttachmentGuidDto command)
    {
        if (command.Guid == Guid.Empty)
            return Result<bool>.Failure(false, "شناسه نامعتبر است");

        var entity = await attachmentRepository.LoadAsync(command.Guid);
        if (entity == null)
            return Result<bool>.Failure(false, "فایل یافت نشد");

        var actor = await GetActorAsync();
        if (!await CanDeleteAsync(entity, actor))
            return Result<bool>.Failure(false, "اجازه‌ی حذف این فایل را ندارید");

        var physical = storageLocations.ResolveStoredFile(entity.StoragePath);

        // 1) حذف از DB و ثبت قطعی؛ 2) سپس حذف فیزیکی (اگر ثبت شکست بخورد فایل سالم می‌ماند)
        attachmentRepository.Delete(entity);
        await attachmentRepository.SaveChangesAsync();
        TryDeletePhysical(physical);

        return Result<bool>.Success(true);
    }

    // -----------------------------
    // حذف چندتایی (گزارش کامل)
    // -----------------------------
    public async Task<Result<BulkDeleteAttachmentsResult>> Handle(DeleteAttachmentGuidsDto command)
    {
        var normalized = (command.Guids ?? Array.Empty<Guid>())
            .Where(g => g != Guid.Empty)
            .Distinct()
            .ToList();

        if (normalized.Count == 0)
        {
            var empty = new BulkDeleteAttachmentsResult(
                Requested: 0,
                Deleted: 0,
                DeletedGuids: Array.Empty<Guid>(),
                NotFoundGuids: Array.Empty<Guid>(),
                PhysicalDeleteFailedGuids: Array.Empty<Guid>()
            );

            return Result<BulkDeleteAttachmentsResult>.Failure(empty, "لیست شناسه‌ها خالی/نامعتبر است");
        }

        var actor = await GetActorAsync();
        var deleted = new List<Guid>(normalized.Count);
        var notFound = new List<Guid>();
        var physicalFailed = new List<Guid>();
        var toDeletePhysical = new List<(Guid Guid, string? Path)>();

        foreach (var guid in normalized)
        {
            var entity = await attachmentRepository.LoadAsync(guid);
            // فایل دیگران (بدون مجوز) مثل «یافت نشد» گزارش می‌شود تا وجودش لو نرود
            if (entity == null || !await CanDeleteAsync(entity, actor))
            {
                notFound.Add(guid);
                continue;
            }

            toDeletePhysical.Add((guid, storageLocations.ResolveStoredFile(entity.StoragePath)));
            attachmentRepository.Delete(entity);
            deleted.Add(guid);
        }

        if (deleted.Count > 0)
            await attachmentRepository.SaveChangesAsync();

        foreach (var item in toDeletePhysical)
            if (!TryDeletePhysical(item.Path))
                physicalFailed.Add(item.Guid);

        var result = new BulkDeleteAttachmentsResult(
            Requested: normalized.Count,
            Deleted: deleted.Count,
            DeletedGuids: deleted,
            NotFoundGuids: notFound,
            PhysicalDeleteFailedGuids: physicalFailed
        );

        return Result<BulkDeleteAttachmentsResult>.Success(result);
    }

    // -----------------------------
    // مجوز حذف
    // -----------------------------
    private sealed record Actor(Guid UserGuid, Guid? SystemGuid, bool IsSuperAdmin);

    /// <summary>
    /// حذف مجاز است برای: ایجادکننده‌ی فایل، سامانه‌ی صاحب فایل (همان client_id که پوشه‌اش را ساخته؛
    /// کنترل دسترسی کسب‌وکاری با خود آن سامانه است) و مدیر کل. سامانه‌ها نمی‌توانند فایل یکدیگر را حذف کنند.
    /// </summary>
    private async Task<bool> CanDeleteAsync(Domain.AttachmentAgg.Attachment entity, Actor actor)
    {
        if (actor.IsSuperAdmin || entity.CreatedBy == actor.UserGuid) return true;
        if (actor.SystemGuid == null || entity.ClassificationId <= 0) return false;

        var classification = await classificationRepository.LoadAsync(entity.ClassificationId);
        return classification != null && classification.SystemGuid == actor.SystemGuid;
    }

    private async Task<Actor> GetActorAsync()
    {
        var userGuid = claimHelper.GetCurrentUserGuid();
        Guid? systemGuid = null;
        var isSuperAdmin = false;

        try
        {
            var clientId = httpContextAccessor.HttpContext?.User.FindFirst("client_id")?.Value;
            if (!string.IsNullOrWhiteSpace(clientId))
                systemGuid = (await userManagementAclService.GetSystemByAsync(clientId))?.Guid;

            var users = await userManagementAclService.GetUsersByGuidsAsync([userGuid]);
            isSuperAdmin = users.Any(u => u.Guid == userGuid && u.IsSuperAdmin);
        }
        catch
        {
            // در دسترس نبودن UserManagement: فقط ایجادکننده اجازه‌ی حذف دارد
        }

        return new Actor(userGuid, systemGuid, isSuperAdmin);
    }

    private static bool TryDeletePhysical(string? physicalPath)
    {
        if (string.IsNullOrWhiteSpace(physicalPath)) return true;
        for (var attempt = 0; attempt < 3; attempt++)
        {
            try
            {
                if (System.IO.File.Exists(physicalPath)) System.IO.File.Delete(physicalPath);
                return true;
            }
            catch (System.IO.IOException) { Thread.Sleep(150 * (attempt + 1)); }
            catch (UnauthorizedAccessException) { return false; }
        }
        return false;
    }
}
