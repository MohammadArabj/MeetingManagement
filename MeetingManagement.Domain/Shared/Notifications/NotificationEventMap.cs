using System.Text.Json;
using MeetingManagement.Common.Extensions;

namespace MeetingManagement.Domain.Shared.Notifications;

/// <summary>
/// نگاشت کد پایدار رویداد ← شناسه ردیف جدول NotificationEvents.
/// جدول ستون «کد» ندارد و اسکیما نباید تغییر کند؛ بنابراین نگاشت در ردیف
/// SystemSettings[NotificationEventMap] نگه‌داری می‌شود (Seeder آن را می‌سازد).
/// </summary>
public static class NotificationEventMap
{
    private static volatile IReadOnlyDictionary<NotificationEventCode, int> _map = new Dictionary<NotificationEventCode, int>();

    public static IReadOnlyDictionary<NotificationEventCode, int> Current => _map;

    public static int? EventIdOf(NotificationEventCode code) => _map.TryGetValue(code, out var id) ? id : null;

    public static NotificationEventCode? CodeOf(int eventId) =>
        _map.FirstOrDefault(kv => kv.Value == eventId) is { Value: > 0 } kv ? kv.Key : null;

    public static void Load(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            _map = new Dictionary<NotificationEventCode, int>();
            return;
        }
        try
        {
            var raw = JsonSerializer.Deserialize<Dictionary<string, int>>(json) ?? [];
            _map = raw
                .Where(kv => short.TryParse(kv.Key, out var c) && Enum.IsDefined(typeof(NotificationEventCode), c))
                .ToDictionary(kv => (NotificationEventCode)short.Parse(kv.Key), kv => kv.Value);
        }
        catch (JsonException)
        {
            _map = new Dictionary<NotificationEventCode, int>();
        }
    }

    public static string Serialize(IReadOnlyDictionary<NotificationEventCode, int> map) =>
        JsonSerializer.Serialize(map.ToDictionary(kv => ((short)kv.Key).ToString(), kv => kv.Value));
}
