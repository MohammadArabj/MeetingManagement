using System.Security.Claims;
using MeetingManagement.Domain.Shared.Access;
using Microsoft.AspNetCore.Http;

namespace MeetingManagement.Application.Services;

/// <summary>
/// پیاده‌سازی <see cref="ICurrentUser"/> بر اساس Claim های توکن SSO.
/// Claim ها: id/sub ، activatedPosition ، isDelegate ، permission (اضافه‌شده توسط CustomTokenRequestValidator).
/// </summary>
public sealed class CurrentUser(IHttpContextAccessor httpContextAccessor) : ICurrentUser
{
    private ClaimsPrincipal? Principal => httpContextAccessor.HttpContext?.User;

    private IReadOnlySet<string>? _permissions;

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated == true;

    public Guid UserGuid
    {
        get
        {
            var raw = Find("id") ?? Find("sub") ?? Find(ClaimTypes.NameIdentifier);
            return Guid.TryParse(raw, out var g) ? g : Guid.Empty;
        }
    }

    public string? ClientId => Find("client_id");

    public bool IsServiceClient => IsAuthenticated && Find("id") is null && Find("sub") is null && Find(ClaimTypes.NameIdentifier) is null;

    public Guid? PositionGuid => Guid.TryParse(Find("activatedPosition"), out var g) && g != Guid.Empty ? g : null;

    public bool IsDelegate => string.Equals(Find("isDelegate"), "true", StringComparison.OrdinalIgnoreCase);

    public IReadOnlySet<string> Permissions =>
        _permissions ??= (Principal?.FindAll("permission").Select(c => c.Value) ?? [])
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

    public bool HasPermission(string permission) => Permissions.Contains(permission);

    public Guid? ResolvePosition(Guid? clientPositionGuid) => PositionGuid ?? clientPositionGuid;

    private string? Find(string type) => Principal?.FindFirst(type)?.Value;
}
