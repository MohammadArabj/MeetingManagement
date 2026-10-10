using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using SurveyManagement.Common;
using SurveyManagement.Domain.Shared.Access;
using SurveyManagement.Domain.Shared.Acls.UserManagement;

namespace SurveyManagement.Infrastructure.Persistence.Access;

/// <summary>
/// پیاده‌سازی <see cref="ISurveyAccessService"/>.
/// نتیجه برای هر نظرسنجی در طول یک درخواست نگه داشته می‌شود؛ واحد سازمانی کاربر (برای دسترسی‌های
/// «واحد») ۱۰ دقیقه کش می‌شود و فقط وقتی خوانده می‌شود که نظرسنجی دسترسی واحدی داشته باشد.
/// </summary>
public sealed class SurveyAccessService(
    SurveyManagementCommandContext context,
    IActingIdentityResolver identityResolver,
    IUserManagementAclService userManagement,
    IMemoryCache cache) : ISurveyAccessService
{
    private readonly Dictionary<long, SurveyAccessInfo?> _byId = new();
    private ActingIdentity? _identity;
    private IReadOnlySet<Guid>? _roleGuids;

    public async Task<ActingIdentity> IdentityAsync() => _identity ??= await identityResolver.ResolveAsync();

    public async Task<SurveyAccessInfo?> GetAsync(Guid surveyGuid)
    {
        var id = await context.Surveys.AsNoTracking()
            .Where(s => s.Guid == surveyGuid && !s.IsRemoved)
            .Select(s => (long?)s.Id)
            .FirstOrDefaultAsync();
        return id.HasValue ? await GetAsync(id.Value) : null;
    }

    public async Task<SurveyAccessInfo?> GetAsync(long surveyId)
    {
        if (_byId.TryGetValue(surveyId, out var known)) return known;

        var survey = await context.Surveys.AsNoTracking()
            .Where(s => s.Id == surveyId && !s.IsRemoved)
            .Select(s => new { s.Id, s.Guid, s.Status, s.AccessType, s.CreatedBy })
            .FirstOrDefaultAsync();
        if (survey is null) return _byId[surveyId] = null;

        var identity = await IdentityAsync();
        var isAdmin = identity.IsSuperAdmin;
        var isOwner = identity.IsAuthenticated && survey.CreatedBy == identity.UserGuid;

        var grants = identity.IsAuthenticated ? await MatchingGrantsAsync(identity, survey.Id) : [];
        var isPublic = survey.AccessType == AccessType.Public && identity.IsAuthenticated;

        var info = new SurveyAccessInfo(
            survey.Id, survey.Guid, survey.Status, survey.AccessType,
            IsOwner: isOwner,
            IsAdmin: isAdmin,
            // کاربران مجزا: نتایج، ویرایش و حذف فقط برای مالک و مدیر سامانه؛ دسترسی‌های تعریف‌شده فقط برای پاسخ‌دادن
            CanView: isAdmin || isOwner || isPublic || grants.Any(g => g.CanView || g.CanRespond),
            CanRespond: isAdmin || isOwner || isPublic || grants.Any(g => g.CanRespond),
            CanViewResults: isAdmin || isOwner,
            CanEdit: isAdmin || (isOwner && survey.Status == SurveyStatus.Draft),
            CanDelete: isAdmin || isOwner);

        return _byId[surveyId] = info;
    }

    public async Task<IReadOnlySet<long>?> ManageableSurveyIdsAsync()
    {
        var identity = await IdentityAsync();
        if (identity.IsSuperAdmin) return null;
        if (!identity.IsAuthenticated) return new HashSet<long>();

        // هر ثبت‌کننده فقط نظرسنجی‌های خودش را می‌بیند (مدیر سامانه همه را)
        return (await context.Surveys.AsNoTracking()
                .Where(s => !s.IsRemoved && s.CreatedBy == identity.UserGuid)
                .Select(s => s.Id)
                .ToListAsync())
            .ToHashSet();
    }

    public async Task<IReadOnlySet<long>> RespondableSurveyIdsAsync()
    {
        var identity = await IdentityAsync();
        if (!identity.IsAuthenticated) return new HashSet<long>();
        return (await AllGrantsAsync(identity)).Where(g => g.CanRespond).Select(g => g.SurveyId).ToHashSet();
    }

    // ───────────────────────────── Helpers ─────────────────────────────

    private sealed record Grant(long SurveyId, Common.TargetType TargetType, Guid? TargetGuid,
        bool CanView, bool CanRespond, bool CanViewResults, bool CanEdit, bool CanDelete);

    private async Task<List<Grant>> MatchingGrantsAsync(ActingIdentity identity, long surveyId)
    {
        var now = DateTime.Now;
        var rows = await context.SurveyAccess.AsNoTracking()
            .Where(a => a.SurveyId == surveyId && a.IsActive == 1 && (a.ExpirationDate == null || a.ExpirationDate >= now))
            .Select(a => new Grant(a.SurveyId, a.TargetType, a.TargetGuid, a.CanView, a.CanRespond, a.CanViewResults, a.CanEdit, a.CanDelete))
            .ToListAsync();
        return await FilterForAsync(identity, rows);
    }

    private async Task<List<Grant>> AllGrantsAsync(ActingIdentity identity)
    {
        var now = DateTime.Now;
        var roles = await RoleGuidsAsync(identity);
        var targets = new List<Guid> { identity.UserGuid };
        if (identity.PositionGuid is { } position) targets.Add(position);
        targets.AddRange(roles);
        var unit = await UnitGuidAsync(identity.UserGuid);
        if (unit is { } u) targets.Add(u);

        var rows = await context.SurveyAccess.AsNoTracking()
            .Where(a => a.IsActive == 1 && (a.ExpirationDate == null || a.ExpirationDate >= now)
                        && a.TargetGuid != null && targets.Contains(a.TargetGuid.Value))
            .Select(a => new Grant(a.SurveyId, a.TargetType, a.TargetGuid, a.CanView, a.CanRespond, a.CanViewResults, a.CanEdit, a.CanDelete))
            .ToListAsync();
        return await FilterForAsync(identity, rows);
    }

    /// <summary>فقط ردیف‌هایی که نوع هدفشان با همان شناسه‌ی کاربر/سمت/واحد/نقش او جور است</summary>
    private async Task<List<Grant>> FilterForAsync(ActingIdentity identity, List<Grant> rows)
    {
        if (rows.Count == 0) return rows;

        IReadOnlySet<Guid>? roles = null;
        Guid? unit = null;
        var unitLoaded = false;
        var result = new List<Grant>();

        foreach (var g in rows)
        {
            if (g.TargetGuid is not { } target) continue;
            var match = g.TargetType switch
            {
                Common.TargetType.User => target == identity.UserGuid,
                Common.TargetType.Position => identity.PositionGuid == target,
                Common.TargetType.Role => (roles ??= await RoleGuidsAsync(identity)).Contains(target),
                Common.TargetType.Unit => await UnitMatchesAsync(),
                _ => false
            };
            if (match) result.Add(g);

            async Task<bool> UnitMatchesAsync()
            {
                if (!unitLoaded) { unit = await UnitGuidAsync(identity.UserGuid); unitLoaded = true; }
                return unit == target;
            }
        }
        return result;
    }

    private async Task<IReadOnlySet<Guid>> RoleGuidsAsync(ActingIdentity identity)
    {
        if (_roleGuids is not null) return _roleGuids;
        var now = DateTime.Now;
        return _roleGuids = (await context.UserSurveyRoles.AsNoTracking()
                .Where(r => r.UserGuid == identity.UserGuid && r.IsActive == 1 && (r.ExpirationDate == null || r.ExpirationDate >= now))
                .Select(r => r.Role.Guid)
                .ToListAsync())
            .ToHashSet();
    }

    private async Task<Guid?> UnitGuidAsync(Guid userGuid)
    {
        var key = $"survey-access:unit:{userGuid:N}";
        if (cache.TryGetValue(key, out Guid? cached)) return cached;
        Guid? unit = null;
        try
        {
            var user = await userManagement.GetUserByAsync(userGuid);
            unit = user is null || user.UnitGuid == Guid.Empty ? null : user.UnitGuid;
            cache.Set(key, unit, TimeSpan.FromMinutes(10));
        }
        catch
        {
            // UserManagement در دسترس نیست: دسترسی «واحد» اعمال نمی‌شود (بسته)، بقیه‌ی قواعد کار می‌کنند
            cache.Set(key, (Guid?)null, TimeSpan.FromSeconds(30));
        }
        return unit;
    }
}
