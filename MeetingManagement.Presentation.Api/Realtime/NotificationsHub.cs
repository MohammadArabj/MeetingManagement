using MeetingManagement.Domain.Shared.Access;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace MeetingManagement.Presentation.Api.Realtime;

/// <summary>
/// Hub اعلان‌های لحظه‌ای سامانه جلسات (/hubs/notifications).
/// ─────────────────────────────────────────────────────────────────────────
/// هر اتصال بر اساس هویت راستی‌آزمایی‌شده به دو گروه اضافه می‌شود: کاربر عامل و سمت فعال.
/// سمت از Query String اتصال (positionGuid) خوانده و مثل هدر X-Position-Guid با UserManagement تأیید می‌شود؛
/// پس کاربر نمی‌تواند با تغییر آن، اعلان‌های سمت دیگری را دریافت کند.
/// متد سمت کلاینت: <c>notification</c> با <see cref="RealtimePayload"/>.
/// </summary>
[Authorize(Policy = "FileManagementApi")]
public sealed class NotificationsHub(IActingIdentityResolver identityResolver, ILogger<NotificationsHub> logger) : Hub
{
    public const string Path = "/hubs/notifications";
    public const string ClientMethod = "notification";

    public static string UserGroup(Guid userGuid) => $"u:{userGuid:N}";
    public static string PositionGroup(Guid positionGuid) => $"p:{positionGuid:N}";

    public override async Task OnConnectedAsync()
    {
        var identity = await identityResolver.ResolveAsync(Context.ConnectionAborted);
        if (identity.UserGuid == Guid.Empty)
        {
            Context.Abort();
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, UserGroup(identity.UserGuid));
        if (identity.PositionGuid is { } position)
            await Groups.AddToGroupAsync(Context.ConnectionId, PositionGroup(position));

        logger.LogDebug("Realtime connection {Connection} joined user {User} / position {Position}",
            Context.ConnectionId, identity.UserGuid, identity.PositionGuid);
        await base.OnConnectedAsync();
    }
}

/// <summary>داده‌ی ارسالی به کلاینت</summary>
public sealed record RealtimePayload(
    string Type,
    string Title,
    string Message,
    string? Link,
    Guid? MeetingGuid,
    DateTime OccurredAt);
