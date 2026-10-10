using System.Security.Claims;
using IdentityServer8.Models;
using Microsoft.EntityFrameworkCore;
using UserManagement.Infrastructure.Persistence;

namespace EPC.SSO.IdentitySettings;

public class IdentityServiceConfiguration(UserManagementCommandContext context)
{
    public IEnumerable<ApiScope> ApiScopes()
    {
        var scopes = context.Scopes.Where(x => x.IsActive == 1).ToList();
        return scopes
            .Select(scope => new ApiScope(scope.Title, scope.Description))
            .ToList();
    }

    //public IEnumerable<Client> Clients(int tokenExpiryTime, string[] allowedOrigins)
    //{
    //    var systems = context.Systems
    //        .Include(x => x.Scopes)
    //        .ThenInclude(systemScope => systemScope.Scope)
    //        .Where(x => x.IsActive == 1)
    //        .ToList();

    //    var clients = new List<Client>();

    //    foreach (var system in systems)
    //    {
    //        var allowedScopes = new List<string> { "openid", "profile" };
    //        allowedScopes.AddRange(system.Scopes.Select(systemScope => systemScope.Scope.Title));

    //        clients.Add(new Client
    //        {
    //            ClientId = system.ClientId,
    //            ClientName = system.Title,
    //            //ClientSecrets = { new Secret(system.Secret.Sha256()) },
    //            AllowedGrantTypes = GrantTypes.CodeAndClientCredentials,

    //            RedirectUris = { $"{system.Url}/#/challenge" },
    //            PostLogoutRedirectUris = { system.Url },
    //            RequireClientSecret = false,
    //            IdentityTokenLifetime = tokenExpiryTime,
    //            AuthorizationCodeLifetime = tokenExpiryTime,
    //            AccessTokenLifetime = tokenExpiryTime,
    //            AllowedCorsOrigins = allowedOrigins,
    //            AllowOfflineAccess = false,
    //            ClientClaimsPrefix = "",
    //            AllowedScopes = allowedScopes,
    //            AlwaysIncludeUserClaimsInIdToken = true,
    //            AlwaysSendClientClaims = true,
    //        });
    //    }

        
    //    return clients;
    //}
    public IEnumerable<Client> Clients(int tokenExpiryTime, string[] allowedOrigins)
    {
        var systems = context.Systems
            .Include(x => x.Scopes).ThenInclude(s => s.Scope)
            .Where(x => x.IsActive == 1)
            .ToList();

        var clients = new List<Client>();

        foreach (var system in systems)
        {
            var allowedScopes = new List<string> { "openid", "profile" };
            allowedScopes.AddRange(system.Scopes.Select(s => s.Scope.Title));

            // ─── کلاینت معمولی — فقط authorization_code ─────────────────────────
            clients.Add(new Client
            {
                ClientId = system.ClientId,
                ClientName = system.Title,
                AllowedGrantTypes = GrantTypes.Code,  // ← برگشت به Code
                // هر دو شکل بازگشت پذیرفته می‌شود: /#/challenge (قدیمی) و /challenge (نسخه‌ی عملیاتی برنامه‌ها)؛
                // تطبیق IdentityServer دقیق است و با یک شکل، ورود یا خروج برنامه‌ی دیگر شکست می‌خورد.
                RedirectUris = { $"{SystemUrl(system.Url)}/#/challenge", $"{SystemUrl(system.Url)}/challenge" },
                PostLogoutRedirectUris = { SystemUrl(system.Url), $"{SystemUrl(system.Url)}/" },
                RequireClientSecret = false,
                IdentityTokenLifetime = tokenExpiryTime,
                // کد یک‌بارمصرف فقط برای چند ثانیه‌ی بین Redirect و Token لازم است (قبلاً هم‌اندازه‌ی توکن: ۸ ساعت)
                AuthorizationCodeLifetime = 300,
                AccessTokenLifetime = tokenExpiryTime,
                AllowedCorsOrigins = allowedOrigins,
                AllowOfflineAccess = false,
                ClientClaimsPrefix = "",
                AllowedScopes = allowedScopes,
                AlwaysIncludeUserClaimsInIdToken = true,
                AlwaysSendClientClaims = true,
            });

            // ─── کلاینت s2s — فقط client_credentials ────────────────────────────
            if (system.HasS2S)
            {
                clients.Add(new Client
                {
                    ClientId = $"{system.ClientId}.s2s",
                    ClientName = $"{system.Title} - S2S",
                    ClientSecrets = { new Secret(system.Secret.Sha256()) },
                    AllowedGrantTypes = GrantTypes.ClientCredentials,
                    AllowedScopes = system.Scopes
                        .Select(s => s.Scope.Title)
                        .ToList(),
                });
            }
        }

        return clients;
    }
    public IEnumerable<IdentityResource> IdentityResources()
    {
        return new List<IdentityResource>
        {
            new IdentityResources.OpenId
            {
                UserClaims = new[]
                {
                    "id",
                    ClaimTypes.Role,
                    ClaimTypes.Email,
                    "Guid",
                    "guid",
                    "position",
                    "positionGuid",
                    "positionTitle",
                    "dbName",
                    "organizationChartGuid",
                    "activatedPosition",
                    "isDelegate",
                    "delegationId",
                    "permission"   // ← جدید
                }
            },
            new IdentityResources.Profile(),
            new IdentityResources.Email()
        };
    }

    private static string SystemUrl(string? url) => (url ?? string.Empty).Trim().TrimEnd('/');
}
