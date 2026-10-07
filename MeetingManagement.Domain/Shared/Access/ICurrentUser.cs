namespace MeetingManagement.Domain.Shared.Access;

/// <summary>
/// کاربر جاری درخواست (از روی Claim های JWT صادرشده توسط SSO).
/// جایگزین ارسال PositionGuid از سمت فرانت در هر Command — که قابل جعل بود.
/// </summary>
public interface ICurrentUser
{
    bool IsAuthenticated { get; }

    /// <summary>کاربر توکن؛ برای توکن سرویس‌به‌سرویس (بدون کاربر) Guid.Empty</summary>
    Guid UserGuid { get; }

    /// <summary>شناسه کلاینت صادرکننده‌ی توکن (claim: client_id)</summary>
    string? ClientId { get; }

    /// <summary>توکن سرویس‌به‌سرویس (client_credentials) است و کاربری پشت آن نیست</summary>
    bool IsServiceClient { get; }

    /// <summary>سمت فعال (claim: activatedPosition)</summary>
    Guid? PositionGuid { get; }

    bool IsDelegate { get; }

    /// <summary>دسترسی‌های سیستمی (claim: permission)</summary>
    IReadOnlySet<string> Permissions { get; }

    bool HasPermission(string permission);

    /// <summary>
    /// اگر PositionGuid در توکن نبود (توکن‌های قدیمی)، مقدار ارسالی کلاینت پذیرفته می‌شود.
    /// اگر بود، مقدار توکن اولویت دارد.
    /// </summary>
    Guid? ResolvePosition(Guid? clientPositionGuid);
}
