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

public class FileQueryHandler(MeetingManagementQueryContext context,IHttpContextAccessor httpContextAccessor,IConfiguration configuration): IQueryHandlerAsync<Result<List<FileDetailsDto>>,FileParameterDto>
{
    public async Task<Result<List<FileDetailsDto>>> Handle(FileParameterDto condition)
    {
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