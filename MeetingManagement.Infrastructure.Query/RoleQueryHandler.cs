using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Infrastructure.Persistence;
using MeetingManagement.Infrastructure.Query.Contracts.Role;
using Microsoft.EntityFrameworkCore;

namespace MeetingManagement.Infrastructure.Query;

public class RoleQueryHandler(MeetingManagementQueryContext context)
    : IQueryHandlerAsync<Result<List<RoleListDto>>>,
      IQueryHandlerAsync<Result<RoleDetailDto>, Guid>,
      IQueryHandlerAsync<Result<List<RoleComboDto>>>
{
    public async Task<Result<List<RoleListDto>>> Handle()
    {
        var roles = await context.Roles
            .Select(r => new RoleListDto
            {
                Guid = r.Guid,
                Title = r.Title,
                Description = r.Description,
                Color = r.Color,
                IsActive = r.IsActive,
                Created = r.Created.ToString("yyyy/MM/dd"),
                Id = r.Id
            })
            .ToListAsync();

        return Result<List<RoleListDto>>.EmptyMessage(roles);
    }

    public async Task<Result<RoleDetailDto>> Handle(Guid condition)
    {
        var role = await context.Roles
            .Where(r => r.Guid == condition)
            .Select(r => new RoleDetailDto
            {
                Guid = r.Guid,
                Title = r.Title,
                Description = r.Description,
                Color = r.Color,
                Id = r.Id
            })
            .FirstOrDefaultAsync();


        return Result<RoleDetailDto>.EmptyMessage(role);
    }

    async Task<Result<List<RoleComboDto>>> IQueryHandlerAsync<Result<List<RoleComboDto>>>.Handle()
    {
        var roles = await context.Roles
            .Where(c => c.IsActive == 1)
            .Select(r => new RoleComboDto
            {
                Guid = r.Guid,
                Title = r.Title,
                Id = r.Id,
                Other = r.Color
            })
            .ToListAsync();

        return Result<List<RoleComboDto>>.EmptyMessage(roles);
    }
}
