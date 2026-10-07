using Epc.Application.Command;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.File;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.FileAgg;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace MeetingManagement.Application;

public class FileCommandHandler(IFileRepository repository,IHttpContextAccessor httpContextAccessor,IConfiguration configuration):ICommandHandlerAsync<DeleteFileDto,Result<bool>>
{
    public async Task<Result<bool>> Handle(DeleteFileDto command)
    {

        var file = await repository.LoadAsync(command.Id);
        if(file==null) return Result<bool>.Failure(false,"فایل مورد نظر یافت نشد");
        var token = httpContextAccessor.HttpContext?.Request.Headers["Authorization"].FirstOrDefault();
        var result =await file.FileGuid.DeleteFileAsync(token, configuration);
        if(result.IsSuccess)
            repository.Delete(file);

        return new Result<bool>(result.IsSuccess, result.IsSuccess,result.IsSuccess ? " عملیات با موفقیت انجام شد":"متاسفانه خطایی در انجام عملیات رخ داد");

    }
}