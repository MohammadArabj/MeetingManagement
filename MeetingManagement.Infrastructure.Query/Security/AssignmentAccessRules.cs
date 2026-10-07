using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.AssignmentAgg;
using MeetingManagement.Domain.Shared.Access;
using MeetingManagement.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MeetingManagement.Infrastructure.Query.Security;

/// <summary>قانون مشترک «چه کسی یک تخصیص (و اقدام‌ها/ارجاع‌هایش) را می‌بیند».</summary>
public static class AssignmentAccessRules
{
    /// <summary>این تخصیص و همه‌ی اجداد آن (آخرین عضو = تخصیص اصلی)</summary>
    public static async Task<List<Assignment>> LoadChainAsync(MeetingManagementQueryContext context, int assignmentId)
    {
        var chain = new List<Assignment>();
        var visited = new HashSet<int>();
        int? currentId = assignmentId;
        while (currentId is { } id && visited.Add(id) && chain.Count <= 50)
        {
            var current = await context.Assignments.AsNoTracking().FirstOrDefaultAsync(a => a.Id == id);
            if (current is null) break;
            chain.Add(current);
            currentId = current.ParentAssignmentId;
        }
        return chain;
    }

    /// <summary>
    /// مجاز است اگر کاربر در زنجیره‌ی تخصیص نقشی داشته باشد (اقدام‌کننده/پیگیری‌کننده/ارجاع‌دهنده‌ی
    /// همین ردیف یا اجدادش) و تخصیص ابلاغ شده باشد، یا در جلسه اجازه‌ی مشاهده‌ی پیگیری‌ها را داشته باشد.
    /// </summary>
    public static async Task<bool> CanViewAsync(IMeetingAccessService accessService, Assignment assignment,
        IReadOnlyCollection<Assignment> chain, ActingIdentity identity)
    {
        var access = await accessService.GetByResolutionAsync(assignment.ResolutionId);
        if (!access.Exists) return false;
        if (access.Can(MeetingCapability.ViewFollowUps)) return true;

        var position = identity.PositionGuid;
        return access.IsPublished && position is not null && chain.Append(assignment).Any(a =>
            a.ActorPositionGuid == position || a.FollowerPositionGuid == position || a.ReferrerPositionGuid == position);
    }

    public static async Task<bool> CanViewAsync(MeetingManagementQueryContext context, IMeetingAccessService accessService,
        int assignmentId, ActingIdentity identity)
    {
        var chain = await LoadChainAsync(context, assignmentId);
        return chain.Count > 0 && await CanViewAsync(accessService, chain[0], chain, identity);
    }
}
