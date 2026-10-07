using MeetingManagement.Common.Extensions;
using MeetingManagement.Common.Security;
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
/// محاسبه دسترسی کاربر روی جلسه — تنها منبع حقیقت برای «چه کسی در این جلسه چه کاری می‌تواند بکند».
/// ─────────────────────────────────────────────────────────────────────────
/// منابع توانایی (اجتماع):
///   ۱) عضویت: ردیفی با سمت فعال کاربر، یا ردیف بدون سمت با کاربر عامل
///   ۲) جانشینی: ردیفی که ReplacementUserGuid آن کاربر عامل است → توانایی‌های همان عضو
///   ۳) ثبت‌کننده‌ی جلسه: مشاهده + ویرایش اطلاعات، اعضا، دستور جلسه و فایل‌ها
///   ۴) دسترسی سیستمی «مشاهده همه جلسات»: فقط مشاهده، و فقط برای جلسات غیر هیئت مدیره
///   ۵) دسترسی سیستمی «مشاهده جلسات هیئت مدیره»: فقط مشاهده‌ی جلسات هیئت مدیره
/// مدیر سامانه همه‌کاره است، مگر در جلسات هیئت مدیره که بدون عضویت یا دسترسی صریح هیچ دسترسی ندارد.
/// </summary>
public sealed class MeetingAccessService(
    MeetingManagementQueryContext context,
    IActingIdentityResolver identityResolver) : IMeetingAccessService
{
    private const MeetingCapability CreatorCapabilities =
        MeetingCapability.ViewAll | MeetingCapability.EditMeeting | MeetingCapability.ManageMembers
        | MeetingCapability.ManageAgenda | MeetingCapability.UploadFiles | MeetingCapability.Print;

    private const MeetingCapability ViewerCapabilities = MeetingCapability.ViewAll | MeetingCapability.Print;

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

    public async Task<MeetingAccess> GetByFileModuleAsync(FileType type, long moduleId, CancellationToken ct = default)
    {
        switch (type)
        {
            case FileType.Meeting:
                return await GetAsync(moduleId, ct);
            case FileType.Resolution:
                return await GetByResolutionAsync(moduleId, ct);
            case FileType.Agenda:
                var meetingId = await context.Agendas.AsNoTracking()
                    .Where(a => a.Id == moduleId)
                    .Select(a => a.MeetingId)
                    .FirstOrDefaultAsync(ct);
                return meetingId is null ? MeetingAccess.NotFound : await GetAsync(meetingId.Value, ct);
            default:
                return MeetingAccess.NotFound;
        }
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
                m.CreatorPositionGuid,
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
        var kind = MeetingKinds.Of(meeting.CategoryGuid);
        var isBoard = kind == MeetingKind.Board;

        var memberships = meeting.Members.Where(mm =>
                (position != null && mm.PositionGuid == position)
                || (mm.PositionGuid == null && mm.UserGuid == user))
            .ToList();
        var substituteFor = meeting.Members.Where(mm => mm.ReplacementUserGuid == user).ToList();
        var roles = memberships.Concat(substituteFor).ToList();

        var capabilities = roles.Aggregate(MeetingCapability.None, (acc, mm) => acc | MeetingRoles.CapabilitiesOf(mm.RoleId));

        var isCreator = meeting.CreatedBy == user || meeting.CreatedBy == identity.TokenUserGuid
                        || (position != null && meeting.CreatorPositionGuid == position);
        if (isCreator)
            capabilities |= CreatorCapabilities;

        // پیش‌نویس فقط برای ثبت‌کننده قابل مشاهده است
        var isDraft = meeting.StatusId == MeetingStatusIds.Draft;
        var isGlobalViewer = false;
        if (!isDraft && roles.Count == 0 && !isCreator)
        {
            var canViewAsGlobal = isBoard
                ? identity.HasExplicitPermission(Permissions.BoardViewAll)
                : identity.HasPermission(Permissions.MeetingsViewAll);
            if (canViewAsGlobal)
            {
                capabilities |= ViewerCapabilities;
                isGlobalViewer = true;
            }
        }
        else if (isDraft && !isCreator)
        {
            capabilities = MeetingCapability.None;
        }

        // مدیر سامانه در جلسات هیئت مدیره فقط با دسترسی صریح همه‌کاره است
        var effectiveSuperAdmin = identity.IsSuperAdmin
                                  && (!isBoard || identity.HasExplicitPermission(Permissions.BoardViewAll) || roles.Count > 0);

        var primaryRoleId = roles
            .Select(mm => mm.RoleId)
            .OrderBy(r => MeetingRoles.Get(r)?.Order ?? int.MaxValue)
            .FirstOrDefault();

        var chairmanId = MeetingRoles.ChairmanId;
        var access = new MeetingAccess
        {
            MeetingId = meeting.Id,
            MeetingGuid = meeting.Guid,
            StatusId = meeting.StatusId,
            Kind = kind,
            RoleId = primaryRoleId,
            RoleKey = MeetingRoles.KeyOf(primaryRoleId),
            RoleTitle = null,
            Capabilities = capabilities,
            IsSuperAdmin = effectiveSuperAdmin,
            IsCreator = isCreator,
            IsSubstitute = memberships.Count == 0 && substituteFor.Count > 0,
            IsGlobalViewer = isGlobalViewer || (effectiveSuperAdmin && roles.Count == 0),
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
