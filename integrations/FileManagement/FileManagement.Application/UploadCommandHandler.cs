using Epc.Application.Command;
using Epc.Identity;
using FileManagement.Application.Contract.Upload;
using FileManagement.Common;
using Microsoft.AspNetCore.StaticFiles;
using FileManagement.Domain.AttachmentAgg;
using FileManagement.Domain.AttachmentAgg.Service;
using FileManagement.Domain.ClassificationAgg;
using FileManagement.Domain.ClassificationAgg.Service;
using FileManagement.Domain.Shared.Acls.UserManagement;
using FileManagement.Domain.UploadSessionAgg;
using System;
using System.IO;
using System.Security.Cryptography;
using System.Threading.Tasks;

namespace FileManagement.Application;

public class UploadCommandHandler(
    IUploadSessionRepository uploadSessionRepository,
    IAttachmentRepository attachmentRepository,
    IClassificationRepository classificationRepository,
    IUserManagementAclService userManagementAclService,
    IClaimHelper claimHelper,
    IClassificationService classificationService,
    IAttachmentService attachmentService,
    ITusFileService tusFileService,
    FileStorageLocations storageLocations,
    FileTypePolicy fileTypePolicy)
    :
        ICommandHandlerAsync<InitiateUpload, InitiateUploadResult>,
        ICommandHandlerAsync<CompleteUpload, CompleteUploadResult>,
        ICommandHandlerAsync<CancelUpload>,
        ICommandHandlerAsync<UpdateUploadProgress>
{
    /// <summary> 
    /// شروع جلسه آپلود TUS 
    /// </summary> 
    public async Task<InitiateUploadResult> Handle(InitiateUpload command)
    {
        try
        {
            var creator = claimHelper.GetCurrentUserGuid();
            var policyError = fileTypePolicy.Validate(command.FileName);
            if (policyError != null)
                throw new Exception(policyError);
            // بررسی سیستم 
            var system = await userManagementAclService.GetSystemByAsync(command.ClientId);
            if (system == null)
                throw new Exception("سیستم مورد نظر یافت نشد.");
            // پردازش مسیر پوشه و ایجاد Classification ها 
            int? classificationId = command.ClassificationId;
            if (!string.IsNullOrEmpty(command.FolderPath))
            {
                classificationId = await EnsureFolderPathExistsAsync(
                    command.FolderPath, system.Guid, system.Id, creator);
            }
            // ایجاد TusFileId یکتا 
            var tusFileId = Guid.NewGuid().ToString("N");
            // ایجاد جلسه آپلود 
            var session = new UploadSession(
                creator: creator,
                tusFileId: tusFileId,
                fileName: command.FileName,
                contentType: ContentTypeFor(command.FileName),
                totalSize: command.FileSize,
                systemGuid: system.Guid,
                folderPath: command.FolderPath,
                classificationId: classificationId
            );
            await uploadSessionRepository.CreateAsync(session);
            await uploadSessionRepository.SaveChangesAsync();
            return new InitiateUploadResult(
                session.Guid,
                tusFileId,
                $"/api/Upload/tus/{tusFileId}",
                session.ExpiresAt
            );
        }
        catch (Exception ex)
        {
            Console.WriteLine( ex.ToString() );
            throw;
        }

      
    }
    /// <summary> 
    /// تکمیل آپلود و ثبت فایل 
    /// </summary> 
    public async Task<CompleteUploadResult> Handle(CompleteUpload command)
    {
        var creator = claimHelper.GetCurrentUserGuid();

        var session = await uploadSessionRepository.LoadAsync(command.SessionGuid);
        if (session == null)
            throw new Exception("جلسه آپلود یافت نشد.");

        // فقط کاربری که آپلود را شروع کرده می‌تواند آن را تکمیل کند
        if (session.CreatedBy != creator)
            throw new UnauthorizedAccessException("این جلسه‌ی آپلود متعلق به شما نیست.");

        // درخواست تکراری (مثلاً تلاش مجدد پس از قطع شبکه) همان نتیجه‌ی قبلی را می‌گیرد
        if (session.Status == UploadSessionStatus.Completed && session.AttachmentGuid.HasValue)
            return new CompleteUploadResult(session.AttachmentGuid.Value, session.FileName, session.TotalSize, session.ContentType);

        var tusFileId = command.TusFileId;
        if (!FileTypePolicy.IsValidTusId(tusFileId))
            throw new Exception("شناسه‌ی فایل آپلودشده نامعتبر است.");

        var tusStatus = await tusFileService.GetUploadStatusAsync(tusFileId);
        if (tusStatus == null || !tusStatus.IsComplete)
            throw new Exception("آپلود فایل هنوز تکمیل نشده است.");

        // فایل tus باید متعلق به همین جلسه باشد (کلاینت sessionId را در metadata می‌فرستد)
        var metadata = await tusFileService.GetMetadataAsync(tusFileId);
        if (metadata != null && metadata.TryGetValue("sessionId", out var boundSession)
            && !string.Equals(boundSession, session.Guid.ToString(), StringComparison.OrdinalIgnoreCase))
            throw new UnauthorizedAccessException("فایل آپلودشده به این جلسه‌ی آپلود تعلق ندارد.");

        var policyError = fileTypePolicy.Validate(session.FileName);
        if (policyError != null)
            throw new Exception(policyError);

        string? tempPath = null;

        try
        {
            var fileName = $"{Guid.NewGuid():N}{Path.GetExtension(session.FileName).ToLowerInvariant()}";
            var (fullPath, storedPath) = storageLocations.NewStoredFile(
                GenerateStorageDirectory(session.SystemGuid, session.ClassificationId), fileName);

            string checksum;
            long size;
            tempPath = fullPath + ".part";

            // ✅ استریم فقط همین‌جا باز است و همین‌جا هم بسته می‌شود
            await using (var tusStream = await tusFileService.GetFileStreamAsync(tusFileId))
            {
                if (tusStream == null)
                    throw new Exception("فایل آپلود شده یافت نشد.");

                if (tusStream.CanSeek) tusStream.Position = 0;

                (checksum, size) = await SaveFileWithChecksumAsync(tusStream, tempPath);
            }

            // انتقال اتمی: هیچ‌وقت فایل نیمه‌نوشته‌شده سرو نمی‌شود
            File.Move(tempPath, fullPath, overwrite: false);
            tempPath = null;

            var attachment = new Attachment(
                creator: creator,
                classificationId: session.ClassificationId ?? 0,
                fileName: fileName,
                originalFileName: session.FileName,
                storagePath: storedPath,
                contentType: ContentTypeFor(session.FileName),
                fileSize: size,
                tusFileId: tusFileId,
                description: command.Description,
                checksum: checksum
            );

            await attachmentRepository.CreateAsync(attachment);

            session.Complete(attachment.Guid);
            await uploadSessionRepository.SaveChangesAsync();

            return new CompleteUploadResult(
                attachment.Guid,
                session.FileName,
                size,
                attachment.ContentType
            );
        }
        catch (Exception ex)
        {
            session.Fail(ex.Message);
            await uploadSessionRepository.SaveChangesAsync();
            throw;
        }
        finally
        {
            if (tempPath != null)
                try { File.Delete(tempPath); } catch (IOException) { }

            // ✅ حالا فایل دیگر توسط استریم شما باز نیست
            _ = await tusFileService.DeleteFileWithRetryAsync(tusFileId);
        }
    }

    /// <summary> 
    /// لغو آپلود 
    /// </summary> 
    public async Task Handle(CancelUpload command)
    {
        var session = await uploadSessionRepository.LoadAsync(command.SessionGuid);
        if (session == null)
            throw new Exception("جلسه آپلود یافت نشد.");
        if (session.CreatedBy != claimHelper.GetCurrentUserGuid())
            throw new UnauthorizedAccessException("این جلسه‌ی آپلود متعلق به شما نیست.");
        // حذف فایل TUS 
        await tusFileService.DeleteFileAsync(session.TusFileId);
        session.Cancel();
        await uploadSessionRepository.SaveChangesAsync();
    }
    /// <summary> 
    /// به‌روزرسانی پیشرفت آپلود 
    /// </summary> 
    public async Task Handle(UpdateUploadProgress command)
    {
        var session = await uploadSessionRepository.GetByTusFileIdAsync(command.TusFileId);
        if (session == null) return;
        session.UpdateProgress(command.UploadedBytes);
        await uploadSessionRepository.SaveChangesAsync();
    }
    #region Private Methods 
    private async Task<int> EnsureFolderPathExistsAsync(
        string folderPath, Guid systemGuid, int systemId, Guid creator)
    {
        var folders = folderPath.Split("{{Folder}}", StringSplitOptions.RemoveEmptyEntries);
        if (folders.Length == 0)
            throw new Exception("مسیر پوشه نامعتبر است.");
        int? parentId = null;
        Classification? currentFolder = null;
        foreach (var folderName in folders)
        {
            var trimmedName = folderName.Trim();
            var existingFolder = classificationRepository.GetByTitle(trimmedName, systemGuid, parentId);
            if (existingFolder == null)
            {
                var newFolder = new Classification(
                    creator: creator,
                    systemGuid: systemGuid,
                    systemId: systemId,
                    title: trimmedName,
                    parentId: parentId,
                    service: classificationService
                );
                await classificationRepository.CreateAsync(newFolder);
                await classificationRepository.SaveChangesAsync();
                currentFolder = newFolder;
                parentId = newFolder.Id;
            }
            else
            {
                currentFolder = existingFolder;
                parentId = existingFolder.Id;
            }
        }
        return currentFolder?.Id ?? 0;
    }
    private static readonly FileExtensionContentTypeProvider ContentTypes = CreateContentTypes();

    private static FileExtensionContentTypeProvider CreateContentTypes()
    {
        var provider = new FileExtensionContentTypeProvider();
        provider.Mappings[".webp"] = "image/webp";
        provider.Mappings[".rar"] = "application/vnd.rar";
        provider.Mappings[".7z"] = "application/x-7z-compressed";
        return provider;
    }

    /// <summary>نوع محتوا از روی پسوند؛ مقدار اعلام‌شده توسط کلاینت قابل اعتماد نیست</summary>
    private static string ContentTypeFor(string? fileName)
        => !string.IsNullOrEmpty(fileName) && ContentTypes.TryGetContentType(fileName, out var type) ? type : "application/octet-stream";

    /// <summary>مسیر نسبی داخل ریشه‌ی فایل‌ها: {system8}/{yyyy}/{MM}/{classHash}</summary>
    private static string GenerateStorageDirectory(Guid systemGuid, int? classificationId)
    {
        var now = DateTime.UtcNow;
        // مسیر کوتاه با hash برای جلوگیری از مشکل path طولانی 
        var classHash = classificationId.HasValue
            ? Convert.ToBase64String(BitConverter.GetBytes(classificationId.Value))
                .Replace("/", "_").Replace("+", "-")[..4]
            : "root";
        return string.Join('/', systemGuid.ToString("N")[..8], now.Year.ToString(), now.Month.ToString("00"), classHash);
    }

    private static async Task<(string Checksum, long Size)> SaveFileWithChecksumAsync(Stream sourceStream, string destinationPath)
    {
        using var sha256 = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        await using var destinationStream = new FileStream(
            destinationPath,
            FileMode.Create,
            FileAccess.Write,
            FileShare.None,
            bufferSize: 1024 * 1024,
            useAsync: true);
        var buffer = new byte[1024 * 1024]; // 1MB buffer (فایل‌های چندگیگابایتی)
        long total = 0;
        int bytesRead;
        while ((bytesRead = await sourceStream.ReadAsync(buffer)) > 0)
        {
            await destinationStream.WriteAsync(buffer.AsMemory(0, bytesRead));
            sha256.AppendData(buffer, 0, bytesRead);
            total += bytesRead;
        }
        await destinationStream.FlushAsync();
        return (Convert.ToHexStringLower(sha256.GetHashAndReset()), total);
    }
    #endregion
}