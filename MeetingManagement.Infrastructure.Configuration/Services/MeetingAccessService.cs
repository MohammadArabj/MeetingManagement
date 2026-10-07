using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.Shared.Access;
using MeetingManagement.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace MeetingManagement.Infrastructure.Configuration.Services;

/// <summary>
/// محاسبه دسترسی کاربر روی جلسه بر اساس نقش او در جلسه و پیکربندی نقش‌ها (<see cref="MeetingRoles"/>).
/// ─────────────────────────────────────────────────────────────────────────
/// قوانین تطبیق عضو:
///   ۱) عضوی که PositionGuid آن برابر سمت فعال است (منطق فعلی سیستم)
///   ۲) عضوی که UserGuid آن برابر کاربر عامل است و سمت ندارد (اعضای بدون سمت)
///   ۳) جانشین: عضوی که ReplacementUserGuid آن برابر کاربر عامل است → همان توانایی‌های عضو اصلی
/// اگر چند عضویت پیدا شود، اجتماع (OR) توانایی‌ها در نظر گرفته می‌شود.
/// </summary>
public sealed class MeetingAccessService(
    MeetingManagementQueryContext context,
    IActingIdentityResolver identityResolver) : IMeetingAccessService
{
    private readonly Dictionary<long, MeetingAccess> _cache = new(); // per-request

    public async Task<MeetingAccess> GetAsync(Guid meetingGuid, CancellationToken ct = default)
    {
        var id = await context.Meetings.AsNoTracking()
            .Where(m => m.Guid == meetingGuid)
            .Select(m => (long?)m.Id)
            .FirstOrDefaultAsync(ct);

        return id is null ? MeetingAccess.NotFound : await GetAsync(id.Value, ct);
    }

    public async Task<MeetingAccess> GetByResolutionAsync(long resolutionId, CancellationToken ct = default)
    {
        var meetingId = await context.Resolutions.AsNoTracking()
            .Where(r => r.Id == resolutionId)
            .Select(r => (long?)r.MeetingId)
            .FirstOrDefaultAsync(ct);

        return meetingId is null ? MeetingAccess.NotFound : await GetAsync(meetingId.Value, ct);
    }

    public async Task<MeetingAccess> GetAsync(long meetingId, CancellationToken ct = default)
    {
        if (_cache.TryGetValue(meetingId, out var cached)) return cached;

        var meeting = await context.Meetings.AsNoTracking()
            .Where(m => m.Id == meetingId && m.IsRemoved != true)
            .Select(m => new
            {
                m.Id,
                Guid = m.Guid ?? Guid.Empty,
                StatusId = m.StatusId ?? 0,
                CategoryGuid = (Guid?)m.Category!.Guid,
                m.CreatedBy,
                Members = m.MeetingMembers.Select(mm => new
                {
                    mm.RoleId,
                    mm.UserGuid,
                    mm.PositionGuid,
                    mm.ReplacementUserGuid,
                    mm.IsSign,
                }).ToList()
            })
            .FirstOrDefaultAsync(ct);

        if (meeting is null) return _cache[meetingId] = MeetingAccess.NotFound;

        var identity = await identityResolver.ResolveAsync(ct);
        var user = identity.UserGuid;
        var position = identity.PositionGuid;

        var memberships = meeting.Members.Where(mm =>
                (position != null && mm.PositionGuid == position)
                || (mm.PositionGuid == null && mm.UserGuid == user))
            .ToList();

        var substituteFor = meeting.Members.Where(mm => mm.ReplacementUserGuid == user).ToList();

        var capabilities = memberships.Concat(substituteFor)
            .Aggregate(MeetingCapability.None, (acc, mm) => acc | MeetingRoles.CapabilitiesOf(mm.RoleId));

        // نقش اصلی برای نمایش: اولویت با عضویت مستقیم، سپس جانشینی؛ و بین چند نقش، نقشی با ترتیب کمتر (مهم‌تر)
        var primaryRoleId = memberships.Concat(substituteFor)
            .Select(mm => mm.RoleId)
            .OrderBy(r => MeetingRoles.Get(r)?.Order ?? int.MaxValue)
            .FirstOrDefault();

        var isCreator = meeting.CreatedBy == user || meeting.CreatedBy == identity.TokenUserGuid;
        if (isCreator)
            capabilities |= MeetingCapability.ViewAll;

        var chairmanId = MeetingRoles.ChairmanId;
        var access = new MeetingAccess
        {
            MeetingId = meeting.Id,
            MeetingGuid = meeting.Guid,
            StatusId = meeting.StatusId,
            Kind = MeetingKinds.Of(meeting.CategoryGuid),
            RoleId = primaryRoleId,
            RoleKey = MeetingRoles.KeyOf(primaryRoleId),
            RoleTitle = null,
            Capabilities = capabilities,
            IsSuperAdmin = identity.IsSuperAdmin,
            IsCreator = isCreator,
            IsSubstitute = memberships.Count == 0 && substituteFor.Count > 0,
            IsGlobalViewer = identity.IsSuperAdmin && memberships.Count == 0,
            ChairmanSigned = meeting.Members.Any(mm => mm.RoleId == chairmanId && mm.IsSign == true),
        };

        if (primaryRoleId is not null)
        {
            var title = await context.Roles.AsNoTracking()
                .Where(r => r.Id == primaryRoleId)
                .Select(r => r.Title)
                .FirstOrDefaultAsync(ct);
            access = access with { RoleTitle = title };
        }

        return _cache[meetingId] = access;
    }
}
