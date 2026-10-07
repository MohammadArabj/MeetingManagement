namespace SurveyManagement.Domain.Shared.Access;

/// <summary>
/// هویتی که کاربر «به نام آن» عمل می‌کند (سمت فعال، تفویض یا ورود به جای کاربر).
/// فرانت انتخاب را با هدرهای X-Acting-User و X-Position-Guid اعلام می‌کند و سرور آن را با
/// UserManagement راستی‌آزمایی می‌کند (همان مدل سامانه مدیریت جلسات).
/// </summary>
public sealed record ActingIdentity(
    Guid TokenUserGuid,
    Guid UserGuid,
    Guid? PositionGuid,
    bool IsDelegate,
    /// <summary>مدیر کل یا دارنده‌ی SV_Admin؛ هرگز از راه تفویض</summary>
    bool IsSuperAdmin,
    bool Verified,
    IReadOnlySet<string> Permissions,
    bool IsImpersonated = false)
{
    public bool IsAuthenticated => UserGuid != Guid.Empty;

    public bool HasPermission(string permission) => IsSuperAdmin || Permissions.Contains(permission);

    public bool HasAnyPermission(IEnumerable<string> permissions) => permissions.Any(HasPermission);
}

public interface IActingIdentityResolver
{
    Task<ActingIdentity> ResolveAsync(CancellationToken ct = default);
}
