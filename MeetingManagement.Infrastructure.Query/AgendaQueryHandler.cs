using MeetingManagement.Domain.Shared.Access;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Infrastructure.Persistence;
using MeetingManagement.Infrastructure.Query.Contracts.Agenda;
using Microsoft.EntityFrameworkCore;

namespace MeetingManagement.Infrastructure.Query;
public class AgendaQueryHandler(MeetingManagementQueryContext context, IMeetingAccessService accessService)
    : IQueryHandlerAsync<Result<List<AgendaListDto>>, Guid>
{
    public async Task<Result<List<AgendaListDto>>> Handle(Guid command)
    {
        var access = await accessService.GetAsync(command);
        if (!access.Can(MeetingCapability.ViewAgenda))
            return Result<List<AgendaListDto>>.Failure([], "شما به دستور این جلسه دسترسی ندارید.");

        var agendas = await context.Agendas
            .Where(c => c.Meeting.Guid == command)
            .OrderBy(c=>c.SortOrder)
            .Select(c => new AgendaListDto
            {
                Text = c.Text,
                Id = c.Id,
                Files=context.Files.Where(x=>x.ModuleId==c.Id&&x.Type==FileType.Agenda).Select(x=>new FileDto(x.Id,false,x.FileGuid)).ToList()
            })
            .ToListAsync();

        return Result<List<AgendaListDto>>.EmptyMessage(agendas);
    }
}
