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
    /// <summary>مدیر کل (سمت مدیر سامانه در UserManagement) یا «ادمین مدیریت جلسات» (MT_Admin)؛ هرگز از راه تفویض</summary>
    bool IsSuperAdmin,
    bool Verified,
    IReadOnlySet<string> Permissions)
{
    /// <summary>دسترسی سیستمی برای سمت/تفویض فعال (مدیر سامانه و ادمین مدیریت جلسات همه را دارند)</summary>
    public bool HasPermission(string permission) => IsSuperAdmin || Permissions.Contains(permission);

    public bool HasAnyPermission(IEnumerable<string> permissions) => permissions.Any(HasPermission);

    /// <summary>
    /// دسترسی صریح؛ مدیر سامانه را مستثنا نمی‌کند.
    /// برای منابع حساس (مثل هیئت مدیره) که مدیر سامانه نیز باید صراحتاً مجوز داشته باشد.
    /// </summary>
    public bool HasExplicitPermission(string permission) => Permissions.Contains(permission);
}

public interface IActingIdentityResolver
{
    Task<ActingIdentity> ResolveAsync(CancellationToken ct = default);
}
