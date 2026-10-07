using System.Security.Claims;
using Epc.Identity;
using MeetingManagement.Domain.Shared.Access;
using Microsoft.AspNetCore.Http;

namespace MeetingManagement.Application.Services;

/// <summary>
/// پیاده‌سازی <see cref="ICurrentUser"/> بر اساس Claim های توکن SSO.
/// Claim ها: id/sub ، activatedPosition ، isDelegate ، permission (اضافه‌شده توسط CustomTokenRequestValidator).
/// </summary>
public sealed class CurrentUser(IHttpContextAccessor httpContextAccessor, IClaimHelper claimHelper) : ICurrentUser
{
    private ClaimsPrincipal? Principal => httpContextAccessor.HttpContext?.User;

    private IReadOnlySet<string>? _permissions;

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated == true;

    public Guid UserGuid
    {
        get
        {
            var raw = Find("id") ?? Find("sub") ?? Find(ClaimTypes.NameIdentifier);
            if (Guid.TryParse(raw, out var g)) return g;
            return claimHelper.GetCurrentUserGuid();
        }
    }

    public Guid? PositionGuid => Guid.TryParse(Find("activatedPosition"), out var g) && g != Guid.Empty ? g : null;

    public bool IsDelegate => string.Equals(Find("isDelegate"), "true", StringComparison.OrdinalIgnoreCase);

    public IReadOnlySet<string> Permissions =>
        _permissions ??= (Principal?.FindAll("permission").Select(c => c.Value) ?? [])
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

    public bool HasPermission(string permission) => Permissions.Contains(permission);

    public Guid? ResolvePosition(Guid? clientPositionGuid) => PositionGuid ?? clientPositionGuid;

    private string? Find(string type) => Principal?.FindFirst(type)?.Value;
}
