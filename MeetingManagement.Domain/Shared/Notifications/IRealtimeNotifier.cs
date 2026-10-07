namespace MeetingManagement.Domain.Shared.Notifications;

/// <summary>یک اعلان لحظه‌ای برای گروهی از کاربران/سمت‌ها.</summary>
public sealed record RealtimeMessage(
    string Type,
    string Title,
    string Message,
    string? Link,
    Guid? MeetingGuid,
    IReadOnlyCollection<Guid> UserGuids,
    IReadOnlyCollection<Guid> PositionGuids)
{
    public DateTime OccurredAt { get; init; } = DateTime.Now;
}

/// <summary>
/// صف اعلان‌های لحظه‌ای در طول یک عملیات.
/// پیام‌ها در طول درخواست جمع می‌شوند و فقط پس از Commit موفق عملیات ارسال می‌شوند
/// (اگر عملیات Rollback شود، هیچ اعلانی ارسال نمی‌شود).
/// </summary>
public interface IRealtimeNotifier
{
    void Enqueue(RealtimeMessage message);

    /// <summary>ارسال پیام‌های صف‌شده (پس از Commit)</summary>
    Task FlushAsync(CancellationToken ct = default);

    /// <summary>دور ریختن پیام‌های صف‌شده (عملیات ناموفق)</summary>
    void Discard();
}

/// <summary>انتقال واقعی پیام به کانال‌ها (SignalR سامانه + پرتال SSO)</summary>
public interface IRealtimeBroadcaster
{
    Task BroadcastAsync(IReadOnlyCollection<RealtimeMessage> messages, CancellationToken ct = default);
}
