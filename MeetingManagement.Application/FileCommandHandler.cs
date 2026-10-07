using Epc.Application.Command;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.File;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Common.Security;
using MeetingManagement.Domain.FileAgg;
using MeetingManagement.Domain.Shared.Access;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace MeetingManagement.Application;

/// <summary>
/// حذف فایل پیوست. حذف برای کسی مجاز است که در جلسه‌ی صاحب فایل اجازه‌ی تغییر آن بخش را دارد
/// (پیوست جلسه: بارگذاری فایل، پیوست مصوبه: مدیریت مصوبات، دستور جلسه: مدیریت دستور جلسه).
/// بارگذاری‌کننده مهم نیست: رئیس، دبیر و دبیر غیرعضو فایل‌های یکدیگر را مدیریت می‌کنند
/// (مثلاً دبیر فایل می‌گذارد و رئیس آن را حذف می‌کند). در جلسات بسته‌شده فقط ادمین.
/// </summary>
public class FileCommandHandler(
    IFileRepository repository,
    IMeetingAccessService accessService,
    IActingIdentityResolver identityResolver,
    IHttpContextAccessor httpContextAccessor,
    IConfiguration configuration) : ICommandHandlerAsync<DeleteFileDto, Result<bool>>
{
    public async Task<Result<bool>> Handle(DeleteFileDto command)
    {
        var file = await repository.LoadAsync(command.Id);
        if (file == null) return Result<bool>.Failure(false, "فایل مورد نظر یافت نشد");

        var access = await accessService.GetByFileModuleAsync(file.Type, file.ModuleId);
        var identity = await identityResolver.ResolveAsync();
        var allowed = file.Type switch
        {
            FileType.Meeting => access.Can(MeetingCapability.UploadFiles),
            FileType.Resolution => access.Can(MeetingCapability.ManageResolutions),
            FileType.Agenda => access.Can(MeetingCapability.ManageAgenda),
            _ => false,
        };
        if (!access.Exists || !allowed)
            return Result<bool>.Failure(false, "شما مجاز به حذف این فایل نیستید.");
        if (MeetingStatusIds.Closed.Contains(access.StatusId) && !access.IsSuperAdmin)
            return Result<bool>.Failure(false, "فایل‌های جلسه‌ی بسته‌شده قابل حذف نیستند.");

        var token = httpContextAccessor.HttpContext?.Request.Headers["Authorization"].FirstOrDefault();
        var result = await file.FileGuid.DeleteFileAsync(token, configuration);
        if (!result.IsSuccess)
            return Result<bool>.Failure(false, "متاسفانه خطایی در حذف فایل از سامانه مدیریت فایل رخ داد");

        repository.Delete(file);
        return Result<bool>.Success(true, " عملیات با موفقیت انجام شد");
    }
}
