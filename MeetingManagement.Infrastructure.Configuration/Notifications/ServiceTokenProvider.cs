using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using MeetingManagement.Domain.Shared.Acls.UserManagement;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace MeetingManagement.Infrastructure.Configuration.Notifications;

/// <summary>
/// دریافت و کش توکن client_credentials از SSO برای Job های پس‌زمینه.
/// پیکربندی (appsettings):
///   "S2S": { "ClientId": "MeetManage.s2s", "ClientSecret": "...", "Scope": "UserManagementApi" }
/// در SSO باید برای سیستم «MeetManage» گزینه HasS2S فعال باشد (کلاینت {ClientId}.s2s ساخته می‌شود).
/// </summary>
public sealed class ServiceTokenProvider(
    IHttpClientFactory httpClientFactory,
    IConfiguration configuration,
    ILogger<ServiceTokenProvider> logger) : IServiceTokenProvider
{
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static string? _token;
    private static DateTime _expiresAt;

    public async Task<string?> GetAuthorizationHeaderAsync(CancellationToken ct = default)
    {
        var clientId = configuration["S2S:ClientId"];
        var secret = configuration["S2S:ClientSecret"];
        var authority = configuration["IdentityAuthorities:0"]?.TrimEnd('/');
        if (string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(secret) || string.IsNullOrEmpty(authority))
            return null;

        if (_token is not null && DateTime.UtcNow < _expiresAt) return _token;

        await Gate.WaitAsync(ct);
        try
        {
            if (_token is not null && DateTime.UtcNow < _expiresAt) return _token;

            var client = httpClientFactory.CreateClient(nameof(ServiceTokenProvider));
            var form = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "client_credentials",
                ["client_id"] = clientId,
                ["client_secret"] = secret,
                ["scope"] = configuration["S2S:Scope"] ?? "UserManagementApi",
            });

            var response = await client.PostAsync($"{authority}/connect/token", form, ct);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("S2S token request failed: {Status}", response.StatusCode);
                return null;
            }

            var body = await response.Content.ReadFromJsonAsync<TokenResponse>(cancellationToken: ct);
            if (body?.AccessToken is null) return null;

            _token = $"Bearer {body.AccessToken}";
            _expiresAt = DateTime.UtcNow.AddSeconds(Math.Max(60, body.ExpiresIn - 60));
            return _token;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "S2S token request error");
            return null;
        }
        finally
        {
            Gate.Release();
        }
    }

    private sealed class TokenResponse
    {
        [JsonPropertyName("access_token")] public string? AccessToken { get; set; }
        [JsonPropertyName("expires_in")] public int ExpiresIn { get; set; }
    }
}
