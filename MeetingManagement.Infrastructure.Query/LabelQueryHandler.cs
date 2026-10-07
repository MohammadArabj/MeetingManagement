using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Infrastructure.Persistence;
using MeetingManagement.Infrastructure.Query.Contracts.Label;
using Microsoft.EntityFrameworkCore;

namespace MeetingManagement.Infrastructure.Query;
public class LabelQueryHandler(MeetingManagementQueryContext context)
    : IQueryHandlerAsync<Result<List<LabelListDto>>>,
      IQueryHandlerAsync<Result<LabelDetailDto>, Guid>,
      IQueryHandlerAsync<Result<List<LabelComboDto>>>
{
    public async Task<Result<List<LabelListDto>>> Handle()
    {
        var labels = await context.Labels
            .Select(l => new LabelListDto
            {
                Guid = l.Guid,
                Title = l.Title,
                Description = l.Description,
                IsActive = l.IsActive,
                Created = l.Created.ToString("yyyy/MM/dd"),
                Id = l.Id,
                Color = l.Color
            })
            .ToListAsync();

        return Result<List<LabelListDto>>.EmptyMessage(labels);
    }

    public async Task<Result<LabelDetailDto>> Handle(Guid condition)
    {
        var label = await context.Labels
            .Where(l => l.Guid == condition)
            .Select(l => new LabelDetailDto
            {
                Guid = l.Guid,
                Title = l.Title,
                Description = l.Description,
                Id = l.Id,
                Color = l.Color
            })
            .FirstOrDefaultAsync();

        return Result<LabelDetailDto>.EmptyMessage(label);
    }

    async Task<Result<List<LabelComboDto>>> IQueryHandlerAsync<Result<List<LabelComboDto>>>.Handle()
    {
        var labels = await context.Labels
            .Select(l => new LabelComboDto
            {
                Guid = l.Guid,
                Title = l.Title,
                Id = l.Id,
                Other = l.Color
            })
            .ToListAsync();

        return Result<List<LabelComboDto>>.EmptyMessage(labels);
    }
}
