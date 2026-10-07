using MeetingManagement.Domain.Shared.Access;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Threading;
using System.Threading.Tasks;

namespace MeetingManagement.Infrastructure.Configuration.Services;

/// <summary>
/// راستی‌آزمایی هویت عامل (سمت فعال / تفویض) و دسترسی‌های آن با UserManagement.
/// ─────────────────────────────────────────────────────────────────────────
///  • سمت و کاربر عامل از هدرهای X-Position-Guid و X-Acting-User خوانده می‌شوند، ولی فقط وقتی
///    پذیرفته می‌شوند که UserManagement تأیید کند این سمت متعلق به کاربر است یا تفویض فعالی دارد.
///  • دسترسی‌ها برای همان سمت/تفویض از UserManagement گرفته می‌شود؛ Claimهای توکن فقط مربوط به
///    سمتی هستند که با آن وارد شده و در تفویض، کل دسترسی‌های سمت را دارند (نه فقط موارد تفویض‌شده).
///  • خطای شبکه «بسته» عمل می‌کند: سمت درخواستی پذیرفته نمی‌شود و فقط هویت خود توکن باقی می‌ماند.
///  • نتیجه‌ی موفق ۱۰ دقیقه و نتیجه‌ی ناموفق ۳۰ ثانیه کش می‌شود.
/// </summary>
public sealed class ActingIdentityResolver(
    IHttpContextAccessor httpContextAccessor,
    ICurrentUser currentUser,
    IMemoryCache cache,
    IHttpClientFactory httpClientFactory,
    IConfiguration configuration,
    ILogger<ActingIdentityResolver> logger) : IActingIdentityResolver
{
    public const string ActingUserHeader = "X-Acting-User";
    public const string PositionHeader = "X-Position-Guid";
    public const string HttpClientName = "UserManagement";

    private static readonly TimeSpan VerifiedCacheDuration = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan FailedCacheDuration = TimeSpan.FromSeconds(30);

    private ActingIdentity? _resolved; // per-request (scoped)

    private string ClientId => configuration["Auth:ClientId"] ?? "MeetManage";

    public async Task<ActingIdentity> ResolveAsync(CancellationToken ct = default)
    {
        if (_resolved is not null) return _resolved;

        if (!currentUser.IsAuthenticated)
            return _resolved = new ActingIdentity(Guid.Empty, Guid.Empty, null, false, false, false, EmptySet);

        var tokenUser = currentUser.UserGuid;
        var tokenPosition = currentUser.PositionGuid;
        var headers = httpContextAccessor.HttpContext?.Request.Headers;

        var actingUser = Guid.TryParse(headers?[ActingUserHeader].FirstOrDefault(), out var au) && au != Guid.Empty ? au : tokenUser;
        var position = Guid.TryParse(headers?[PositionHeader].FirstOrDefault(), out var p) && p != Guid.Empty ? p : tokenPosition;

        if (position is null)
            return _resolved = TokenOnly(tokenUser, tokenPosition, verified: actingUser == tokenUser);

        var cacheKey = $"acting:{tokenUser:N}:{actingUser:N}:{position:N}";
        if (cache.TryGetValue(cacheKey, out ActingIdentity? cached) && cached is not null)
            return _resolved = cached;

        var identity = await VerifyAsync(tokenUser, tokenPosition, actingUser, position.Value, ct);
        cache.Set(cacheKey, identity, identity.Verified ? VerifiedCacheDuration : FailedCacheDuration);
        return _resolved = identity;
    }

    private async Task<ActingIdentity> VerifyAsync(Guid tokenUser, Guid? tokenPosition, Guid actingUser, Guid position, CancellationToken ct)
    {
        try
        {
            var client = CreateClient();
            if (client is null) return Fallback();

            using var response = await client.PostAsJsonAsync("api/Delegation/GetActiveDelegationsForDelegatee",
                new { UserGuid = tokenUser, PositionGuid = tokenPosition ?? position }, ct);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Delegation lookup failed ({Status}) for user {User}", response.StatusCode, tokenUser);
                return Fallback();
            }

            var rows = await response.Content.ReadFromJsonAsync<List<IdentityRow>>(cancellationToken: ct) ?? [];
            var match = rows.FirstOrDefault(x => x.PositionGuid == position && x.UserGuid == actingUser);
            if (match is null)
            {
                logger.LogWarning("User {User} requested unverified acting identity {Acting}/{Position}", tokenUser, actingUser, position);
                return Fallback();
            }

            var permissions = match.IsDelegate
                ? await GetPermissionsAsync(client, "api/Delegation/GetDelegationPermissions", new { DelegationId = match.Id, ClientId }, ct)
                : await GetPermissionsAsync(client, "api/Permission/GetPositionPermissions", new { ClientId, PositionGuid = position }, ct);

            if (permissions is null) return Fallback();

            return new ActingIdentity(tokenUser, actingUser, position, match.IsDelegate,
                // مدیر سامانه بودن در تفویض به تفویض‌گیرنده منتقل نمی‌شود
                IsSuperAdmin: match.IsSuperAdmin && !match.IsDelegate,
                Verified: true, permissions);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Acting identity verification error");
            return Fallback();
        }

        // فقط هویت خود توکن، بدون هیچ ارتقای دسترسی
        ActingIdentity Fallback() => TokenOnly(tokenUser, tokenPosition,
            verified: actingUser == tokenUser && tokenPosition == position);
    }

    private ActingIdentity TokenOnly(Guid tokenUser, Guid? tokenPosition, bool verified) =>
        new(tokenUser, tokenUser, tokenPosition, IsDelegate: false, IsSuperAdmin: false, verified,
            // در توکنِ تفویض، Claimهای permission کل دسترسی‌های سمت است؛ پس قابل اعتماد نیست
            currentUser.IsDelegate ? EmptySet : currentUser.Permissions);

    private async Task<IReadOnlySet<string>?> GetPermissionsAsync(HttpClient client, string path, object body, CancellationToken ct)
    {
        using var response = await client.PostAsJsonAsync(path, body, ct);
        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning("Permission lookup {Path} failed ({Status})", path, response.StatusCode);
            return null;
        }

        var csv = await response.Content.ReadFromJsonAsync<string>(cancellationToken: ct) ?? string.Empty;
        return csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    private HttpClient? CreateClient()
    {
        var baseUrl = configuration["UserManagementUrl"]?.TrimEnd('/');
        var token = httpContextAccessor.HttpContext?.Request.Headers.Authorization.FirstOrDefault();
        if (string.IsNullOrEmpty(baseUrl) || string.IsNullOrEmpty(token)) return null;

        var client = httpClientFactory.CreateClient(HttpClientName);
        client.BaseAddress = new Uri(baseUrl + "/");
        client.DefaultRequestHeaders.Authorization = AuthenticationHeaderValue.Parse(token);
        return client;
    }

    private static readonly IReadOnlySet<string> EmptySet = new HashSet<string>();

    private sealed class IdentityRow
    {
        public int Id { get; set; }
        public Guid UserGuid { get; set; }
        public Guid PositionGuid { get; set; }
        public bool IsDelegate { get; set; }
        public bool IsSuperAdmin { get; set; }
    }
}
