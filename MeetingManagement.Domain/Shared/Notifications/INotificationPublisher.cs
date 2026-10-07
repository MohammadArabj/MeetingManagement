using MeetingManagement.Common.Extensions;

namespace MeetingManagement.Domain.Shared.Notifications;

/// <summary>یک گیرنده مشخص (برای رویدادهای مبتنی بر تخصیص: اقدام‌کننده، پیگیری‌کننده، ارجاع‌دهنده).</summary>
public sealed record NotificationTarget(
    NotificationRecipient As,
    Guid? UserGuid,
    Guid? PositionGuid = null,
    string? Mobile = null,
    string? Name = null);

/// <summary>داده‌های رویداد برای ساخت متن پیام و یافتن گیرندگان.</summary>
public sealed class NotificationPayload
{
    public long? MeetingId { get; init; }
    public long? ResolutionId { get; init; }
    public int? AssignmentId { get; init; }

    /// <summary>گیرندگان صریح (اقدام‌کننده/پیگیری‌کننده/...)</summary>
    public List<NotificationTarget> Targets { get; init; } = [];

    /// <summary>مقادیر اضافه برای جایگذاری در قالب: {Key}</summary>
    public Dictionary<string, string?> Values { get; init; } = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>کاربری که رویداد را ایجاد کرده (برای او پیام ارسال نمی‌شود)</summary>
    public Guid? ActorUserGuid { get; init; }
}

/// <summary>
/// انتشار رویداد اطلاع‌رسانی.
/// پیام‌ها در همان تراکنش درخواست، در جدول NotificationLogs با وضعیت pending ثبت می‌شوند (الگوی Outbox)
/// و Job پس‌زمینه آن‌ها را ارسال می‌کند؛ بنابراین خرابی پنل پیامک هیچ‌وقت عملیات کاربر را خراب نمی‌کند.
/// </summary>
public interface INotificationPublisher
{
    Task PublishAsync(NotificationEventCode code, NotificationPayload payload, CancellationToken ct = default);
}
