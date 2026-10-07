using MeetingManagement.Domain.Shared.Access;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Infrastructure.Persistence;
using MeetingManagement.Infrastructure.Query.Contracts.File;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace MeetingManagement.Infrastructure.Query;

public class FileQueryHandler(MeetingManagementQueryContext context, IMeetingAccessService accessService): IQueryHandlerAsync<Result<List<FileDetailsDto>>,FileParameterDto>
{
    public async Task<Result<List<FileDetailsDto>>> Handle(FileParameterDto condition)
    {
        // شناسه‌ی فایل در سامانه مدیریت فایل حکم کلید دسترسی را دارد؛ فقط به کسی داده می‌شود که آن بخش را می‌بیند
        var access = await accessService.GetByFileModuleAsync(condition.Type, condition.ModuleId);
        var required = condition.Type switch
        {
            FileType.Resolution => MeetingCapability.ViewResolutions,
            FileType.Agenda => MeetingCapability.ViewAgenda,
            _ => MeetingCapability.ViewFiles,
        };
        if (!access.Can(required))
            return Result<List<FileDetailsDto>>.Failure([], "شما به فایل‌های این بخش دسترسی ندارید.");

        var files = await context.Files
            .Where(c => c.ModuleId == condition.ModuleId && c.Type == condition.Type)
            .Select(c => new FileDetailsDto()
            {
                FileGuid=c.FileGuid,
                Id=c.Id
            })
            .ToListAsync();


        return new Result<List<FileDetailsDto>>(true,files) ;
    }

}