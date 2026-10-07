namespace MeetingManagement.Common.Security;

/// <summary>
/// مقدار این ویژگی در سرور با «کاربر عامل» راستی‌آزمایی‌شده جایگزین می‌شود
/// (کاربر توکن، یا تفویض‌دهنده در حالت تفویض). هر مقداری که کلاینت بفرستد نادیده گرفته می‌شود.
/// فقط روی ویژگی‌هایی بگذارید که معنی «کاربر جاری» دارند، نه «کاربر هدف».
/// </summary>
[AttributeUsage(AttributeTargets.Property)]
public sealed class CallerUserAttribute : Attribute;

/// <summary>
/// مقدار این ویژگی در سرور با سمت فعال راستی‌آزمایی‌شده جایگزین می‌شود.
/// </summary>
[AttributeUsage(AttributeTargets.Property)]
public sealed class CallerPositionAttribute : Attribute;

/// <summary>
/// ویژگی bool که در سرور برابر «کاربر حداقل یکی از این دسترسی‌ها را دارد» قرار می‌گیرد.
/// </summary>
[AttributeUsage(AttributeTargets.Property)]
public sealed class CallerHasPermissionAttribute(params string[] permissions) : Attribute
{
    public IReadOnlyList<string> Permissions { get; } = permissions;
}
