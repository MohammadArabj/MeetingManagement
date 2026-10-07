namespace MeetingManagement.Domain.Shared.Access;

/// <summary>
/// هویتی که کاربر «به نام آن» عمل می‌کند.
/// در این سامانه کاربر می‌تواند سمت فعال را عوض کند یا به‌عنوان تفویض‌گیرنده به جای شخص دیگری کار کند؛
/// فرانت این انتخاب را با هدرهای X-Acting-User و X-Position-Guid اعلام می‌کند و سرور آن را
/// با سرویس تفویض UserManagement راستی‌آزمایی می‌کند (نتیجه کش می‌شود).
/// </summary>
public sealed record ActingIdentity(
    Guid TokenUserGuid,
    Guid UserGuid,
    Guid? PositionGuid,
    bool IsDelegate,
    bool IsSuperAdmin,
    bool Verified);

public interface IActingIdentityResolver
{
    Task<ActingIdentity> ResolveAsync(CancellationToken ct = default);
}
