using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Infrastructure.Persistence;
using MeetingManagement.Infrastructure.Query.Contracts.Status;
using Microsoft.EntityFrameworkCore;

namespace MeetingManagement.Infrastructure.Query;
public class StatusQueryHandler(MeetingManagementQueryContext context)
    : IQueryHandlerAsync<Result<List<StatusListDto>>>,
      IQueryHandlerAsync<Result<StatusDetailDto>, Guid>,
      IQueryHandlerAsync<Result<List<StatusComboDto>>>
{
    public async Task<Result<List<StatusListDto>>> Handle()
    {
        var statuses = await context.MeetingStatuses
            .Select(s => new StatusListDto
            {
                Guid = s.Guid,
                Title = s.Title,
                Description = s.Description,
                IsActive = s.IsActive,
                Created = s.Created.ToString("yyyy/MM/dd"),
                Id = s.Id,
            })
            .ToListAsync();

        return Result<List<StatusListDto>>.EmptyMessage(statuses);
    }

    public async Task<Result<StatusDetailDto>> Handle(Guid condition)
    {
        var status = await context.MeetingStatuses
            .Where(s => s.Guid == condition)
            .Select(s => new StatusDetailDto
            {
                Guid = s.Guid,
                Title = s.Title,
                Description = s.Description,
                Id = s.Id,
            })
            .FirstOrDefaultAsync();

        return status == null ? Result<StatusDetailDto>.Failure(null, "وضعیت مورد نظر یافت نشد.") : Result<StatusDetailDto>.EmptyMessage(status);
    }

    async Task<Result<List<StatusComboDto>>> IQueryHandlerAsync<Result<List<StatusComboDto>>>.Handle()
    {
        var statuses = await context.MeetingStatuses
            .Select(s => new StatusComboDto
            {
                Guid = s.Guid,
                Title = s.Title,
                Id = s.Id,
            })
            .ToListAsync();


        return Result<List<StatusComboDto>>.EmptyMessage(statuses);
    }
}
