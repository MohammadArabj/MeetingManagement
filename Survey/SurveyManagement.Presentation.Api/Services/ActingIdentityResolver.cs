using SurveyManagement.Common.Security;
using SurveyManagement.Domain.Shared.Access;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Threading;
using System.Threading.Tasks;

namespace SurveyManagement.Presentation.Api.Services;

/// <summary>
/// راستی‌آزمایی هویت عامل (سمت فعال / تفویض) و دسترسی‌های آن با UserManagement.
/// ─────────────────────────────────────────────────────────────────────────
///  • سمت و کاربر عامل از هدرهای X-Position-Guid و X-Acting-User خوانده می‌شوند، ولی فقط وقتی
///    پذیرفته می‌شوند که UserManagement تأیید کند این سمت متعلق به کاربر است یا تفویض فعالی دارد.
///  • دسترسی‌ها برای همان سمت/تفویض از UserManagement گرفته می‌شود؛ Claimهای توکن فقط مربوط به
///    سمتی هستند که با آن وارد شده و در تفویض، کل دسترسی‌های سمت را دارند (نه فقط موارد تفویض‌شده).
///  • خطای شبکه «بسته» عمل می‌کند: سمت درخواستی پذیرفته نمی‌شود و فقط هویت خود توکن باقی می‌ماند.
///  • نتیجه‌ی موفق ۱۰ دقیقه و نتیجه‌ی ناموفق ۳۰ ثانیه (خطای زمانی ۱۰ ثانیه) کش می‌شود.
///  • درخواست‌های همزمان یک کاربر فقط یک بار UserManagement را صدا می‌زنند (single-flight) و این فراخوانی
///    به لغو درخواست HTTP وابسته نیست؛ قطع شدن یک درخواست، راستی‌آزمایی بقیه را لغو نمی‌کند.
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
    private static readonly TimeSpan TimeoutCacheDuration = TimeSpan.FromSeconds(10);
    private static readonly TimeSpan VerifyTimeout = TimeSpan.FromSeconds(8);

    /// <summary>راستی‌آزمایی‌های در حال اجرا (مشترک بین درخواست‌های همزمان)</summary>
    private static readonly ConcurrentDictionary<string, Lazy<Task<(ActingIdentity Identity, TimeSpan CacheFor)>>> InFlight = new();

    private ActingIdentity? _resolved; // per-request (scoped)

    private string ClientId => configuration["Auth:ClientId"] ?? "SurveyCode";

    public async Task<ActingIdentity> ResolveAsync(CancellationToken ct = default)
    {
        if (_resolved is not null) return _resolved;

        // توکن سرویس‌به‌سرویس هیچ هویت کاربری ندارد و هیچ هدر سمت/تفویضی از آن پذیرفته نمی‌شود
        if (!currentUser.IsAuthenticated || currentUser.IsServiceClient)
            return _resolved = new ActingIdentity(Guid.Empty, Guid.Empty, null, false, false, false, EmptySet);

        var tokenUser = currentUser.UserGuid;
        var tokenPosition = currentUser.PositionGuid;
        var headers = httpContextAccessor.HttpContext?.Request.Headers;

        // اتصال WebSocket (Hub) هدر سفارشی ندارد؛ همان مقادیر از Query String خوانده می‌شوند و مثل هدر راستی‌آزمایی می‌شوند
        var request = httpContextAccessor.HttpContext?.Request;
        var isHub = request?.Path.StartsWithSegments("/hubs") == true;
        var actingRaw = headers?[ActingUserHeader].FirstOrDefault() ?? (isHub ? request!.Query["actingUser"].FirstOrDefault() : null);
        var positionRaw = headers?[PositionHeader].FirstOrDefault() ?? (isHub ? request!.Query["positionGuid"].FirstOrDefault() : null);

        var actingUser = Guid.TryParse(actingRaw, out var au) && au != Guid.Empty ? au : tokenUser;
        var position = Guid.TryParse(positionRaw, out var p) && p != Guid.Empty ? p : tokenPosition;

        if (position is null)
            return _resolved = TokenOnly(tokenUser, tokenPosition, verified: actingUser == tokenUser);

        var cacheKey = $"acting:{tokenUser:N}:{actingUser:N}:{position:N}";
        if (cache.TryGetValue(cacheKey, out ActingIdentity? cached) && cached is not null)
            return _resolved = cached;

        // آدرس و توکن همین‌جا خوانده می‌شوند؛ کار مشترک نباید به HttpContext درخواست دیگری وابسته باشد
        var client = CreateClient();
        var tokenPermissions = TokenPermissions();
        var job = InFlight.GetOrAdd(cacheKey, _ => new Lazy<Task<(ActingIdentity, TimeSpan)>>(
            () => VerifyAndCacheAsync(cacheKey, client, tokenPermissions, tokenUser, tokenPosition, actingUser, position.Value)));

        var (identity, _) = await job.Value.WaitAsync(ct);
        return _resolved = identity;
    }

    private async Task<(ActingIdentity Identity, TimeSpan CacheFor)> VerifyAndCacheAsync(
        string cacheKey, HttpClient? client, IReadOnlySet<string> tokenPermissions, Guid tokenUser, Guid? tokenPosition, Guid actingUser, Guid position)
    {
        try
        {
            using var timeout = new CancellationTokenSource(VerifyTimeout);
            var result = await VerifyAsync(client, tokenPermissions, tokenUser, tokenPosition, actingUser, position, timeout.Token);
            cache.Set(cacheKey, result.Identity, result.CacheFor);
            return result;
        }
        finally
        {
            InFlight.TryRemove(cacheKey, out _);
        }
    }

    private async Task<(ActingIdentity Identity, TimeSpan CacheFor)> VerifyAsync(
        HttpClient? client, IReadOnlySet<string> tokenPermissions, Guid tokenUser, Guid? tokenPosition, Guid actingUser, Guid position, CancellationToken ct)
    {
        try
        {
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
                // سمت/کاربر درخواستی متعلق به خود کاربر یا تفویض‌شده به او نیست → شاید «ورود به جای کاربر» باشد
                var impersonated = await TryImpersonateAsync(client, rows, tokenUser, tokenPosition, actingUser, position, ct);
                if (impersonated is not null) return (impersonated, VerifiedCacheDuration);

                logger.LogWarning("User {User} requested unverified acting identity {Acting}/{Position}", tokenUser, actingUser, position);
                return Fallback();
            }

            var permissions = match.IsDelegate
                ? await GetPermissionsAsync(client, "api/Delegation/GetDelegationPermissions", new { DelegationId = match.Id, ClientId }, ct)
                : await GetPermissionsAsync(client, "api/Permission/GetPositionPermissions", new { ClientId, PositionGuid = position }, ct);

            if (permissions is null) return Fallback();

            return (new ActingIdentity(tokenUser, actingUser, position, match.IsDelegate,
                // مدیر کل یا سمت دارای «مدیر سامانه نظرسنجی» (SV_Admin)؛ هیچ‌کدام در تفویض به تفویض‌گیرنده منتقل نمی‌شود
                IsSuperAdmin: !match.IsDelegate && (match.IsSuperAdmin || permissions.Contains(SurveyPermissions.Admin)),
                Verified: true, permissions), VerifiedCacheDuration);
        }
        catch (OperationCanceledException)
        {
            // پاسخ نگرفتن از UserManagement در زمان مجاز (نه لغو درخواست کاربر)
            logger.LogWarning("Acting identity verification timed out after {Timeout}s for user {User}", VerifyTimeout.TotalSeconds, tokenUser);
            return Fallback(TimeoutCacheDuration);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Acting identity verification error");
            return Fallback();
        }

        // فقط هویت خود توکن، بدون هیچ ارتقای دسترسی
        (ActingIdentity, TimeSpan) Fallback(TimeSpan? cacheFor = null) => (TokenOnly(tokenUser, tokenPosition,
            verified: actingUser == tokenUser && tokenPosition == position, tokenPermissions), cacheFor ?? FailedCacheDuration);
    }

    /// <summary>
    /// «ورود به جای کاربر»: فقط برای مدیر کل یا سمت دارای SV_Admin / SV_Impersonate (سمت خود کاربر، نه تفویض).
    /// UserManagement هم همین شرط را مستقل بررسی می‌کند و تعلق سمت به کاربر هدف را تأیید می‌کند.
    /// دسترسی‌ها دقیقاً دسترسی‌های سمت کاربر هدف است (مدیر چیزی بیش از او نمی‌بیند).
    /// </summary>
    private async Task<ActingIdentity?> TryImpersonateAsync(HttpClient client, List<IdentityRow> ownRows,
        Guid tokenUser, Guid? tokenPosition, Guid actingUser, Guid position, CancellationToken ct)
    {
        if (actingUser == tokenUser) return null;

        var own = ownRows.Where(r => !r.IsDelegate && r.UserGuid == tokenUser).ToList();
        if (own.Count == 0) return null;

        var allowed = own.Any(r => r.IsSuperAdmin);
        if (!allowed)
        {
            var adminPosition = own.FirstOrDefault(r => r.PositionGuid == tokenPosition) ?? own[0];
            var adminPermissions = await GetPermissionsAsync(client, "api/Permission/GetPositionPermissions",
                new { ClientId, PositionGuid = adminPosition.PositionGuid }, ct);
            allowed = adminPermissions is not null
                      && (adminPermissions.Contains(SurveyPermissions.Admin) || adminPermissions.Contains(SurveyPermissions.Impersonate));
        }
        if (!allowed) return null;

        using var response = await client.PostAsJsonAsync("api/Delegation/GetActiveDelegationsForDelegatee",
            new { UserGuid = actingUser, PositionGuid = position }, ct);
        if (!response.IsSuccessStatusCode) return null;

        var targetRows = await response.Content.ReadFromJsonAsync<List<IdentityRow>>(cancellationToken: ct) ?? [];
        var target = targetRows.FirstOrDefault(r => !r.IsDelegate && r.UserGuid == actingUser && r.PositionGuid == position);
        if (target is null) return null;

        var permissions = await GetPermissionsAsync(client, "api/Permission/GetPositionPermissions",
            new { ClientId, PositionGuid = position }, ct);
        if (permissions is null) return null;

        logger.LogInformation("User {Admin} is impersonating {User} with position {Position}", tokenUser, actingUser, position);
        return new ActingIdentity(tokenUser, actingUser, position, IsDelegate: false,
            IsSuperAdmin: target.IsSuperAdmin || permissions.Contains(SurveyPermissions.Admin),
            Verified: true, permissions, IsImpersonated: true);
    }

    private ActingIdentity TokenOnly(Guid tokenUser, Guid? tokenPosition, bool verified, IReadOnlySet<string>? permissions = null) =>
        new(tokenUser, tokenUser, tokenPosition, IsDelegate: false, IsSuperAdmin: false, verified, permissions ?? TokenPermissions());

    /// <summary>در توکنِ تفویض، Claimهای permission کل دسترسی‌های سمت است؛ پس قابل اعتماد نیست</summary>
    private IReadOnlySet<string> TokenPermissions() => currentUser.IsDelegate ? EmptySet : currentUser.Permissions;

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
        var request = httpContextAccessor.HttpContext?.Request;
        var token = request?.Headers.Authorization.FirstOrDefault();
        if (string.IsNullOrEmpty(token) && request?.Query["access_token"].FirstOrDefault() is { Length: > 0 } queryToken)
            token = "Bearer " + queryToken;
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
