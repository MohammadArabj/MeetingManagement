using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Channels;
using MeetingManagement.Domain.Shared.Notifications;
using Microsoft.AspNetCore.SignalR;

namespace MeetingManagement.Presentation.Api.Realtime;

/// <summary>
/// ارسال اعلان‌های لحظه‌ای به:
///   ۱) کلاینت‌های همین سامانه از طریق <see cref="NotificationsHub"/>
///   ۲) پرتال SSO (اگر Realtime:Sso:Url تنظیم شده باشد) — در پس‌زمینه و بدون معطل کردن درخواست کاربر
/// </summary>
public sealed class RealtimeBroadcaster(IHubContext<NotificationsHub> hub, SsoRealtimeRelay ssoRelay) : IRealtimeBroadcaster
{
    public async Task BroadcastAsync(IReadOnlyCollection<RealtimeMessage> messages, CancellationToken ct = default)
    {
        foreach (var message in messages)
        {
            var groups = message.UserGuids.Select(NotificationsHub.UserGroup)
                .Concat(message.PositionGuids.Select(NotificationsHub.PositionGroup))
                .Distinct()
                .ToList();
            if (groups.Count == 0) continue;

            var payload = new RealtimePayload(message.Type, message.Title, message.Message, message.Link,
                message.MeetingGuid, message.OccurredAt);
            await hub.Clients.Groups(groups).SendAsync(NotificationsHub.ClientMethod, payload, ct);
        }

        ssoRelay.Enqueue(messages);
    }
}

/// <summary>
/// صف ارسال اعلان به پرتال SSO.
/// درخواست با HMAC-SHA256 (کلید مشترک Realtime:Sso:SharedSecret) امضا می‌شود:
///   X-Realtime-Timestamp: زمان Unix (ثانیه)
///   X-Realtime-Signature: Base64(HMAC(secret, "{timestamp}.{body}"))
/// SSO درخواست‌های بدون امضای معتبر یا قدیمی‌تر از ۵ دقیقه را رد می‌کند.
/// </summary>
public sealed class SsoRealtimeRelay(IConfiguration configuration, ILogger<SsoRealtimeRelay> logger)
{
    private readonly Channel<RealtimeMessage[]> _queue = Channel.CreateBounded<RealtimeMessage[]>(
        new BoundedChannelOptions(1000) { FullMode = BoundedChannelFullMode.DropOldest, SingleReader = true });

    public string? Url => configuration["Realtime:Sso:Url"];
    public string? Secret => configuration["Realtime:Sso:SharedSecret"];
    public bool Enabled => !string.IsNullOrWhiteSpace(Url) && !string.IsNullOrWhiteSpace(Secret);

    public ChannelReader<RealtimeMessage[]> Reader => _queue.Reader;

    public void Enqueue(IReadOnlyCollection<RealtimeMessage> messages)
    {
        // پرتال SSO کاربر را با شناسه‌ی کاربر می‌شناسد (نه سمت)
        var forPortal = messages.Where(m => m.UserGuids.Count > 0).ToArray();
        if (!Enabled || forPortal.Length == 0) return;
        if (!_queue.Writer.TryWrite(forPortal))
            logger.LogWarning("SSO realtime queue is full; {Count} messages dropped", forPortal.Length);
    }

    public HttpRequestMessage BuildRequest(IReadOnlyCollection<RealtimeMessage> messages)
    {
        var body = JsonSerializer.Serialize(new
        {
            source = configuration["Realtime:Sso:SourceName"] ?? "MeetManage",
            items = messages.Select(m => new
            {
                type = m.Type,
                title = m.Title,
                message = m.Message,
                link = m.Link,
                users = m.UserGuids,
                occurredAt = m.OccurredAt,
            }),
        });

        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(Secret!));
        var signature = Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes($"{timestamp}.{body}")));

        var request = new HttpRequestMessage(HttpMethod.Post, Url)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json"),
        };
        request.Headers.Add("X-Realtime-Timestamp", timestamp);
        request.Headers.Add("X-Realtime-Signature", signature);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        return request;
    }
}

/// <summary>ارسال‌کننده‌ی پس‌زمینه‌ی صف SSO (با یک تلاش مجدد)</summary>
public sealed class SsoRealtimeRelayWorker(
    SsoRealtimeRelay relay,
    IHttpClientFactory httpClientFactory,
    ILogger<SsoRealtimeRelayWorker> logger) : BackgroundService
{
    public const string HttpClientName = "SsoRealtime";

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var batch in relay.Reader.ReadAllAsync(stoppingToken))
        {
            for (var attempt = 1; attempt <= 2; attempt++)
            {
                try
                {
                    using var request = relay.BuildRequest(batch);
                    using var response = await httpClientFactory.CreateClient(HttpClientName).SendAsync(request, stoppingToken);
                    if (response.IsSuccessStatusCode) break;
                    logger.LogWarning("SSO realtime relay returned {Status}", response.StatusCode);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    logger.LogWarning(ex, "SSO realtime relay failed (attempt {Attempt})", attempt);
                }

                await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken);
            }
        }
    }
}
