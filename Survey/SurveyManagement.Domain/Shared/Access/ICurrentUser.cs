namespace SurveyManagement.Domain.Shared.Access;

/// <summary>کاربر جاری درخواست (از روی Claim های JWT صادرشده توسط SSO)</summary>
public interface ICurrentUser
{
    bool IsAuthenticated { get; }

    /// <summary>کاربر توکن؛ برای توکن سرویس‌به‌سرویس (بدون کاربر) Guid.Empty</summary>
    Guid UserGuid { get; }

    string? ClientId { get; }

    /// <summary>توکن سرویس‌به‌سرویس (client_credentials) است و کاربری پشت آن نیست</summary>
    bool IsServiceClient { get; }

    Guid? PositionGuid { get; }

    bool IsDelegate { get; }

    IReadOnlySet<string> Permissions { get; }
}
