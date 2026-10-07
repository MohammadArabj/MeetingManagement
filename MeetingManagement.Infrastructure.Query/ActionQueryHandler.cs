using MeetingManagement.Domain.Shared.Access;
using MeetingManagement.Infrastructure.Query.Security;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Epc.Application.Command;
using Epc.Application.Query;
using Epc.Company.Query;
using Epc.Identity;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.Shared.Acls.UserManagement;
using MeetingManagement.Infrastructure.Acl;
using MeetingManagement.Infrastructure.Persistence;
using MeetingManagement.Infrastructure.Query.Contracts.Action;
using MeetingManagement.Infrastructure.Query.Contracts.Assignment;
using Microsoft.EntityFrameworkCore;
using NHibernate.Mapping;

namespace MeetingManagement.Infrastructure.Query;

public class ActionQueryHandler(
    MeetingManagementQueryContext context,
    IUserManagementAclService userManagementAclService,
    IActingIdentityResolver identityResolver,
    IMeetingAccessService accessService)
    : IQueryHandlerAsync<Result<List<ActionListDto>>, int>
{
   
    public async Task<Result<List<ActionListDto>>> Handle(int command)
    {
        var identity = await identityResolver.ResolveAsync();
        if (!await AssignmentAccessRules.CanViewAsync(context, accessService, command, identity))
            return Result<List<ActionListDto>>.Failure([], "شما به اقدامات این تخصیص دسترسی ندارید.");

        // اول همه فرزندان رو پیدا کن
        var allAssignmentIds = await GetAssignmentAndChildrenIds(command);

        var query = context.Actions
            .Where(c => allAssignmentIds.Contains(c.AssignmentId))
            .Select(c => new
            {
                c.Id,
                Description = c.Description,
                Type = c.Type.ToString(),
                //Status = c.Status != null ? c.Status.GetDisplayName() : c.FollowStatus.GetDisplayName(),
                Date = c.ActionDate.ToString("yyyy/MM/dd"),
                //StatusStr = c.Status.ToString(),
                //FollowStatus = c.FollowStatus.ToString(),
                c.UserGuid
            });

        var assignmentsRaw = await query.ToListAsync();


        var userGuids = assignmentsRaw
            .SelectMany(a => new[] { a?.UserGuid })
            .Distinct()
            .ToList();

        var users = await userManagementAclService.GetUsersByGuidsAsync(userGuids);
        var userDictionary = users.ToDictionary(u => u.Guid, u => u.Fullname);

        var assignments = assignmentsRaw.Select(a => new ActionListDto()
        {
            Id = a.Id,
            Date = a.Date,
            Description = a.Description,
            //Status = a.Status,
            Type = a.Type,
            //StatusStr = a.StatusStr,
            //FollowStatus = a.FollowStatus,
            UserName = userDictionary.TryGetValue(a.UserGuid, out var value) ? value : ""
        }).ToList();

        return Result<List<ActionListDto>>.Success(assignments);
    }

    private async Task<List<int>> GetAssignmentAndChildrenIds(int assignmentId)
    {
        var result = new List<int> { assignmentId };

        var children = await context.Assignments
            .Where(a => a.ParentAssignmentId == assignmentId)
            .Select(a => a.Id)
            .ToListAsync();

        foreach (var childId in children)
        {
            result.AddRange(await GetAssignmentAndChildrenIds(childId));
        }

        return result;
    }

}