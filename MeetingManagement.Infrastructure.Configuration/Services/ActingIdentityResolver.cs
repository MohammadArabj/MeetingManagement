using MeetingManagement.Domain.Shared.Access;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using RestSharp;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace MeetingManagement.Infrastructure.Configuration.Services;

/// <summary>
/// راستی‌آزمایی هویت عامل (سمت فعال / تفویض) با API تفویض UserManagement.
/// نتیجه برای هر (کاربر توکن، کاربر عامل، سمت) به مدت ۱۰ دقیقه کش می‌شود تا هر درخواست
/// یک فراخوانی شبکه اضافه نداشته باشد.
/// </summary>
public sealed class ActingIdentityResolver(
    IHttpContextAccessor httpContextAccessor,
    ICurrentUser currentUser,
    IMemoryCache cache,
    IConfiguration configuration,
    ILogger<ActingIdentityResolver> logger) : IActingIdentityResolver
{
    public const string ActingUserHeader = "X-Acting-User";
    public const string PositionHeader = "X-Position-Guid";

    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(10);

    private ActingIdentity? _resolved; // per-request (scoped)

    public async Task<ActingIdentity> ResolveAsync(CancellationToken ct = default)
    {
        if (_resolved is not null) return _resolved;

        var tokenUser = currentUser.UserGuid;
        var tokenPosition = currentUser.PositionGuid;
        var headers = httpContextAccessor.HttpContext?.Request.Headers;

        var actingUser = Guid.TryParse(headers?[ActingUserHeader].FirstOrDefault(), out var au) && au != Guid.Empty ? au : tokenUser;
        var position = Guid.TryParse(headers?[PositionHeader].FirstOrDefault(), out var p) && p != Guid.Empty ? p : tokenPosition;

        if (position is null)
            return _resolved = new ActingIdentity(tokenUser, tokenUser, null, false, false, Verified: actingUser == tokenUser);

        var cacheKey = $"acting:{tokenUser:N}:{actingUser:N}:{position:N}";
        if (cache.TryGetValue(cacheKey, out ActingIdentity? cached) && cached is not null)
            return _resolved = cached;

        var identity = await VerifyAsync(tokenUser, actingUser, position.Value, tokenPosition, ct);
        cache.Set(cacheKey, identity, CacheDuration);
        return _resolved = identity;
    }

    private async Task<ActingIdentity> VerifyAsync(Guid tokenUser, Guid actingUser, Guid position, Guid? tokenPosition, CancellationToken ct)
    {
        try
        {
            var baseUrl = configuration["UserManagementUrl"]?.TrimEnd('/');
            var token = httpContextAccessor.HttpContext?.Request.Headers.Authorization.FirstOrDefault();
            if (string.IsNullOrEmpty(baseUrl) || string.IsNullOrEmpty(token))
                return Fallback();

            using var client = new RestClient(new RestClientOptions($"{baseUrl}/api/Delegation") { Timeout = TimeSpan.FromSeconds(10) });
            var request = new RestRequest("GetActiveDelegationsForDelegatee", Method.Post)
                .AddHeader("Authorization", token)
                .AddJsonBody(new { UserGuid = tokenUser, PositionGuid = tokenPosition ?? position });

            var response = await client.ExecuteAsync<List<IdentityRow>>(request, ct);
            if (!response.IsSuccessful || response.Data is null)
            {
                logger.LogWarning("Delegation lookup failed ({Status}) for user {User}", response.StatusCode, tokenUser);
                return Fallback();
            }

            var match = response.Data.FirstOrDefault(x => x.PositionGuid == position && x.UserGuid == actingUser);
            if (match is not null)
                return new ActingIdentity(tokenUser, actingUser, position, match.IsDelegate, match.IsSuperAdmin, Verified: true);

            logger.LogWarning("User {User} requested unverified acting identity {Acting}/{Position}", tokenUser, actingUser, position);
            return new ActingIdentity(tokenUser, tokenUser, tokenPosition, false, false, Verified: false);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Acting identity verification error");
            return Fallback();
        }

        ActingIdentity Fallback() =>
            actingUser == tokenUser && (tokenPosition is null || tokenPosition == position)
                ? new ActingIdentity(tokenUser, tokenUser, position, false, false, Verified: true)
                : new ActingIdentity(tokenUser, tokenUser, tokenPosition, false, false, Verified: false);
    }

    private sealed class IdentityRow
    {
        public Guid UserGuid { get; set; }
        public Guid PositionGuid { get; set; }
        public bool IsDelegate { get; set; }
        public bool IsSuperAdmin { get; set; }
    }
}
