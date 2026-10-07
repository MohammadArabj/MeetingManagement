using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading;
using System.Threading.Tasks;
using MeetingManagement.Domain.SettingAgg;
using Microsoft.Extensions.Logging;

namespace MeetingManagement.Infrastructure.Configuration.Notifications;

public sealed record SmsSendResult(bool Success, string? Error);

public interface ISmsSender
{
    Task<SmsSendResult> SendAsync(string mobile, string text, CancellationToken ct = default);
}

/// <summary>
/// ارسال پیامک از طریق پنل سازمان: POST {SmsUrl}/api/SmsApi/SendSmsPost  { Number, Text }
/// (همان قراردادی که SSO استفاده می‌کند). در حالت آزمایشی فقط لاگ می‌شود.
/// </summary>
public sealed class HttpSmsSender(IHttpClientFactory httpClientFactory, ILogger<HttpSmsSender> logger) : ISmsSender
{
    public const string HttpClientName = "SmsClient";

    public async Task<SmsSendResult> SendAsync(string mobile, string text, CancellationToken ct = default)
    {
        if (SettingValues.SmsTestMode)
        {
            logger.LogInformation("[SMS TEST MODE] {Mobile}: {Text}", mobile, text);
            return new SmsSendResult(true, null);
        }

        var baseUrl = SettingValues.SmsUrl?.TrimEnd('/');
        if (string.IsNullOrWhiteSpace(baseUrl))
            return new SmsSendResult(false, "آدرس پنل پیامک تنظیم نشده است.");

        try
        {
            var client = httpClientFactory.CreateClient(HttpClientName);
            using var response = await client.PostAsJsonAsync($"{baseUrl}/api/SmsApi/SendSmsPost",
                new { Number = mobile, Text = text }, ct);

            if (response.IsSuccessStatusCode) return new SmsSendResult(true, null);

            var body = await response.Content.ReadAsStringAsync(ct);
            return new SmsSendResult(false, $"HTTP {(int)response.StatusCode}: {Truncate(body, 500)}");
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            return new SmsSendResult(false, ex.Message);
        }
    }

    private static string Truncate(string s, int max) => s.Length <= max ? s : s[..max];
}
