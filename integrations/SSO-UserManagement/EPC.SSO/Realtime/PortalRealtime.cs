using System.Collections.Concurrent;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace EPC.SSO.Realtime;

/// <summary>
/// Hub اعلان‌های لحظه‌ای پرتال (/hubs/portal). احراز هویت با همان کوکی ورود SSO است و هر اتصال
/// فقط در گروه کاربر خودش (claim: sub) قرار می‌گیرد.
/// متد سمت کلاینت: <c>portalNotification</c>
/// </summary>
[Authorize]
public sealed class PortalHub : Hub
{
    public const string Path = "/hubs/portal";
    public const string ClientMethod = "portalNotification";

    public static string UserGroup(Guid userGuid) => $"u:{userGuid:N}";

    public override async Task OnConnectedAsync()
    {
        var sub = Context.User?.FindFirst("sub")?.Value ?? Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(sub, out var userGuid))
        {
            Context.Abort();
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, UserGroup(userGuid));
        await base.OnConnectedAsync();
    }
}

/// <summary>
/// نسخه‌ی کش داشبورد هر کاربر. با رسیدن رویداد جدید (مثلاً ثبت جلسه) نسخه افزایش می‌یابد تا
/// ویجت‌های کش‌شده (جلسات پیش رو) بلافاصله از منبع خوانده شوند.
/// </summary>
public sealed class PortalCacheVersions
{
    private readonly ConcurrentDictionary<Guid, int> _versions = new();

    public int Of(Guid userGuid) => _versions.TryGetValue(userGuid, out var v) ? v : 0;

    public void Bump(Guid userGuid) => _versions.AddOrUpdate(userGuid, 1, (_, v) => v + 1);
}

/// <summary>منبع مجاز ارسال اعلان (مثلاً سامانه جلسات) و کلید مشترک آن</summary>
public sealed class RealtimeSourceOptions
{
    public string Name { get; set; } = string.Empty;
    public string SharedSecret { get; set; } = string.Empty;
}

public sealed record PortalNotification(
    [property: JsonPropertyName("source")] string Source,
    [property: JsonPropertyName("type")] string Type,
    [property: JsonPropertyName("title")] string Title,
    [property: JsonPropertyName("message")] string Message,
    [property: JsonPropertyName("link")] string? Link,
    [property: JsonPropertyName("occurredAt")] DateTime OccurredAt);

/// <summary>
/// دریافت اعلان از سامانه‌های دیگر و ارسال لحظه‌ای به کاربران پرتال.
/// ─────────────────────────────────────────────────────────────────────────
/// امنیت: درخواست باید با HMAC-SHA256 و کلید مشترک همان منبع (Realtime:Sources) امضا شده باشد:
///   X-Realtime-Timestamp : زمان Unix (ثانیه) — حداکثر ۵ دقیقه اختلاف
///   X-Realtime-Signature : Base64(HMAC(secret, "{timestamp}.{body}"))
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/realtime")]
public sealed class RealtimeController(
    IHubContext<PortalHub> hub,
    PortalCacheVersions cacheVersions,
    IConfiguration configuration,
    ILogger<RealtimeController> logger) : ControllerBase
{
    private static readonly TimeSpan MaxClockSkew = TimeSpan.FromMinutes(5);
    private const int MaxBodyBytes = 256 * 1024;

    private sealed class Envelope
    {
        [JsonPropertyName("source")] public string? Source { get; set; }
        [JsonPropertyName("items")] public List<Item> Items { get; set; } = [];
    }

    private sealed class Item
    {
        [JsonPropertyName("type")] public string? Type { get; set; }
        [JsonPropertyName("title")] public string? Title { get; set; }
        [JsonPropertyName("message")] public string? Message { get; set; }
        [JsonPropertyName("link")] public string? Link { get; set; }
        [JsonPropertyName("users")] public List<Guid> Users { get; set; } = [];
        [JsonPropertyName("occurredAt")] public DateTime? OccurredAt { get; set; }
    }

    [HttpPost("publish")]
    [RequestSizeLimit(MaxBodyBytes)]
    public async Task<IActionResult> Publish(CancellationToken ct)
    {
        Request.EnableBuffering();
        using var reader = new StreamReader(Request.Body, Encoding.UTF8, leaveOpen: true);
        var body = await reader.ReadToEndAsync(ct);

        Envelope? envelope;
        try
        {
            envelope = JsonSerializer.Deserialize<Envelope>(body);
        }
        catch (JsonException)
        {
            return BadRequest();
        }

        var source = (configuration.GetSection("Realtime:Sources").Get<List<RealtimeSourceOptions>>() ?? [])
            .FirstOrDefault(s => string.Equals(s.Name, envelope?.Source, StringComparison.OrdinalIgnoreCase));
        if (envelope is null || source is null || string.IsNullOrWhiteSpace(source.SharedSecret)
            || !IsValidSignature(body, source.SharedSecret))
        {
            logger.LogWarning("Rejected realtime publish from {Ip} (source {Source})", HttpContext.Connection.RemoteIpAddress, envelope?.Source);
            return Unauthorized();
        }

        foreach (var item in envelope.Items.Where(i => i.Users.Count > 0).Take(500))
        {
            var notification = new PortalNotification(
                source.Name,
                Truncate(item.Type, 64),
                Truncate(item.Title, 200),
                Truncate(item.Message, 1000),
                IsSafeLink(item.Link) ? item.Link : null,
                item.OccurredAt ?? DateTime.Now);

            var users = item.Users.Distinct().Take(1000).ToList();
            foreach (var user in users) cacheVersions.Bump(user);

            await hub.Clients.Groups(users.Select(PortalHub.UserGroup).ToList())
                .SendAsync(PortalHub.ClientMethod, notification, ct);
        }

        return Ok(new { received = envelope.Items.Count });
    }

    private bool IsValidSignature(string body, string secret)
    {
        var timestampRaw = Request.Headers["X-Realtime-Timestamp"].ToString();
        var signature = Request.Headers["X-Realtime-Signature"].ToString();
        if (!long.TryParse(timestampRaw, out var timestamp) || string.IsNullOrEmpty(signature)) return false;

        var sentAt = DateTimeOffset.FromUnixTimeSeconds(timestamp);
        if ((DateTimeOffset.UtcNow - sentAt).Duration() > MaxClockSkew) return false;

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var expected = Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes($"{timestampRaw}.{body}")));
        return CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(expected), Encoding.ASCII.GetBytes(signature));
    }

    /// <summary>فقط لینک http/https (جلوگیری از javascript: و ...)</summary>
    private static bool IsSafeLink(string? link) =>
        Uri.TryCreate(link, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);

    private static string Truncate(string? value, int max) =>
        string.IsNullOrEmpty(value) ? string.Empty : value.Length <= max ? value : value[..max];
}
