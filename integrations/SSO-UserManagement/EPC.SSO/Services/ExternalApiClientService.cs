using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using EPC.SSO.Facades;
using EPC.SSO.Infrastructure;
using IdentityModel.Client;
using UserManagement.Infrastructure.Query.Contract.UserPortal;

namespace EPC.SSO.Services;

public class ExternalApiConfiguration
{
    public string BaseUrl { get; set; } = string.Empty;
    public int SystemId { get; set; }
    public int ScopeId { get; set; }

    /// <summary>حداکثر زمان انتظار برای هر درخواست (ثانیه). پیش‌فرض ۱۰.</summary>
    public int TimeoutSeconds { get; set; } = 10;
}

/// <summary>
/// تأمین و نگهداری توکن‌های Server-to-Server (client_credentials).
/// Singleton است؛ اطلاعات integration را با یک Scope کوتاه‌عمر از UserManagement می‌خواند.
/// </summary>
public sealed class S2STokenProvider(
    IHttpClientFactory httpClientFactory,
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration,
    ILogger<S2STokenProvider> logger)
{
    private readonly ConcurrentDictionary<string, (string Token, DateTime ExpiresUtc)> _tokens = new();
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _locks = new();
    // بعد از شکست، چند ثانیه دوباره تلاش نمی‌شود؛ وگرنه هنگام قطعی IdentityServer هر درخواست
    // پشت قفل منتظر یک تلاش ۱۰ ثانیه‌ای می‌ماند و درخواست‌ها روی هم انباشته می‌شدند.
    private readonly ConcurrentDictionary<string, DateTime> _failedUntil = new();
    private static readonly TimeSpan FailureBackoff = TimeSpan.FromSeconds(15);
    private readonly ConcurrentDictionary<string, (SystemIntegrationViewModel Info, DateTime ExpiresUtc)> _clientInfo = new();
    private readonly SemaphoreSlim _discoveryLock = new(1, 1);

    private DiscoveryDocumentResponse? _discovery;
    private DateTime _discoveryExpiresUtc = DateTime.MinValue;

    public async Task<string?> GetTokenAsync(string apiName, ExternalApiConfiguration cfg, CancellationToken cancellationToken)
    {
        var key = $"{apiName}:{cfg.SystemId}:{cfg.ScopeId}";
        if (_tokens.TryGetValue(key, out var cached) && cached.ExpiresUtc > DateTime.UtcNow)
            return cached.Token;
        if (_failedUntil.TryGetValue(key, out var until) && until > DateTime.UtcNow)
            return null;

        var gate = _locks.GetOrAdd(key, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken);
        try
        {
            if (_tokens.TryGetValue(key, out cached) && cached.ExpiresUtc > DateTime.UtcNow)
                return cached.Token;
            if (_failedUntil.TryGetValue(key, out until) && until > DateTime.UtcNow)
                return null;

            var token = await RequestTokenAsync(apiName, cfg, key, cancellationToken);
            if (token is null)
                _failedUntil[key] = DateTime.UtcNow.Add(FailureBackoff);
            else
                _failedUntil.TryRemove(key, out _);
            return token;
        }
        catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogError(ex, "[{ApiName}] دریافت توکن s2s ناموفق", apiName);
            _failedUntil[key] = DateTime.UtcNow.Add(FailureBackoff);
            return null;
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task<string?> RequestTokenAsync(string apiName, ExternalApiConfiguration cfg, string key, CancellationToken cancellationToken)
    {
        {

            var info = await GetClientInfoAsync(apiName, cfg);
            if (info is null || string.IsNullOrWhiteSpace(info.ClientId) || string.IsNullOrWhiteSpace(info.Secret))
                return null;

            var http = httpClientFactory.CreateClient(HttpClientSetup.IdentityServerClient);
            var discovery = await GetDiscoveryAsync(http, cancellationToken);
            if (discovery is null) return null;

            // ⚠️ رفتار قبلی حفظ شده: scope سیستم + UserManagementApi.
            // اگر کلاینت s2s اجازه‌ی UserManagementApi را نداشته باشد IdentityServer خطای invalid_scope
            // می‌دهد و هیچ داده‌ای نمی‌آید. با تنظیم "IncludeUserManagementScope": false غیرفعال کنید.
            var includeUm = configuration.GetValue("ExternalApis:IncludeUserManagementScope", true);
            var scopes = new List<string>();
            if (!string.IsNullOrWhiteSpace(info.Scope)) scopes.Add(info.Scope);
            if (includeUm) scopes.Add("UserManagementApi");

            var response = await http.RequestClientCredentialsTokenAsync(new ClientCredentialsTokenRequest
            {
                Address = discovery.TokenEndpoint,
                ClientId = $"{info.ClientId}.s2s",
                ClientSecret = info.Secret,
                Scope = string.Join(' ', scopes)
            }, cancellationToken);

            if (response.IsError || string.IsNullOrWhiteSpace(response.AccessToken))
            {
                logger.LogError("[{ApiName}] دریافت توکن s2s ناموفق: {Error} {Description}",
                    apiName, response.Error, response.ErrorDescription);
                return null;
            }

            var lifetime = Math.Max(30, response.ExpiresIn - 120);
            _tokens[key] = (response.AccessToken, DateTime.UtcNow.AddSeconds(lifetime));
            return response.AccessToken;
        }
    }

    public void Invalidate(string apiName, ExternalApiConfiguration cfg)
    {
        var key = $"{apiName}:{cfg.SystemId}:{cfg.ScopeId}";
        _tokens.TryRemove(key, out _);
        _failedUntil.TryRemove(key, out _);
    }

    public async Task<string> GetSystemUrlAsync(int systemId)
    {
        var info = await GetClientInfoAsync("SystemUrl", new ExternalApiConfiguration { SystemId = systemId });
        return info?.Url ?? string.Empty;
    }

    private async Task<SystemIntegrationViewModel?> GetClientInfoAsync(string apiName, ExternalApiConfiguration cfg)
    {
        var key = $"{cfg.SystemId}:{cfg.ScopeId}";
        if (_clientInfo.TryGetValue(key, out var cached) && cached.ExpiresUtc > DateTime.UtcNow)
            return cached.Info;

        try
        {
            using var scope = scopeFactory.CreateScope();
            var facade = scope.ServiceProvider.GetRequiredService<ISystemIntegrationQueryFacade>();
            var info = await facade.Get(new SystemIntegrationSearchModel
            {
                SystemId = cfg.SystemId,
                ScopeId = cfg.ScopeId == 0 ? null : cfg.ScopeId
            });

            if (info is null)
            {
                logger.LogError("[{ApiName}] تنظیمات integration برای SystemId={SystemId}, ScopeId={ScopeId} یافت نشد",
                    apiName, cfg.SystemId, cfg.ScopeId);
                return cached.Info; // اگر قبلاً داشتیم همان
            }

            // قبلاً برای همیشه کش می‌شد (تغییر Secret نیاز به ری‌استارت داشت). حالا ۳۰ دقیقه.
            _clientInfo[key] = (info, DateTime.UtcNow.AddMinutes(30));
            return info;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[{ApiName}] خواندن تنظیمات integration ناموفق بود", apiName);
            return cached.Info;
        }
    }

    private async Task<DiscoveryDocumentResponse?> GetDiscoveryAsync(HttpClient http, CancellationToken cancellationToken)
    {
        if (_discovery is not null && _discoveryExpiresUtc > DateTime.UtcNow)
            return _discovery;

        await _discoveryLock.WaitAsync(cancellationToken);
        try
        {
            if (_discovery is not null && _discoveryExpiresUtc > DateTime.UtcNow)
                return _discovery;

            // ⚠️ آدرس داخلی فقط وقتی مجاز است که IssuerUri ثابت تنظیم شده باشد.
            //    در غیر این صورت IdentityServer نام میزبان درخواست (مثلاً 127.0.0.1) را به‌عنوان iss در توکن
            //    می‌گذارد، APIها آن را با Authority خودشان یکی نمی‌دانند و همه‌ی درخواست‌ها 401 می‌شوند
            //    (علت «اطلاعیه‌ها/جلسات در دسترس نیست»).
            var issuerUri = configuration["IdentityServer:IssuerUri"];
            var internalAuthority = configuration["IdentityServer:InternalAuthority"];
            var authority = !string.IsNullOrWhiteSpace(issuerUri) && !string.IsNullOrWhiteSpace(internalAuthority)
                ? internalAuthority
                : configuration["IdentityServer:Authority"]
                  ?? throw new InvalidOperationException("IdentityServer:Authority تعریف نشده است.");

            var discovery = await http.GetDiscoveryDocumentAsync(new DiscoveryDocumentRequest
            {
                Address = authority,
                Policy =
                {
                    RequireHttps = false,
                    // وقتی از آدرس داخلی استفاده می‌شود، Issuer ممکن است با آن یکی نباشد.
                    ValidateIssuerName = false,
                    ValidateEndpoints = false
                }
            }, cancellationToken);

            if (discovery.IsError)
            {
                logger.LogError("IdentityServer discovery error: {Error}", discovery.Error);
                return _discovery; // آخرین نسخه‌ی سالم
            }

            _discovery = discovery;
            _discoveryExpiresUtc = DateTime.UtcNow.AddHours(12);
            return discovery;
        }
        finally
        {
            _discoveryLock.Release();
        }
    }
}

/// <summary>
/// Gateway مشترک SSO برای APIهای داخلی.
/// API عمومی آن با نسخه‌ی قبلی یکسان است تا سرویس‌های دیگر (PhoneDirectory و ...) تغییری لازم نداشته باشند.
///
/// تغییرات:
///  • هر درخواست Timeout مستقل دارد (پیش‌فرض ۵ ثانیه، قابل تنظیم برای هر API).
///  • پاسخ 401 → توکن باطل و یک‌بار دیگر تلاش می‌شود (قبلاً تا انقضای توکن همه‌چیز خراب می‌ماند).
///  • توکن و Discovery در یک Singleton نگهداری می‌شوند (S2STokenProvider).
/// </summary>
public sealed class ExternalApiClientService(
    IHttpClientFactory httpClientFactory,
    S2STokenProvider tokenProvider,
    ILogger<ExternalApiClientService> logger)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public Task<string?> GetTokenAsync(string apiName, ExternalApiConfiguration apiConfig, CancellationToken cancellationToken = default)
        => tokenProvider.GetTokenAsync(apiName, apiConfig, cancellationToken);

    public Task<T?> GetAsync<T>(string apiName, ExternalApiConfiguration apiConfig, string endpoint, CancellationToken cancellationToken = default)
        => SendJsonAsync<T>(apiName, apiConfig, () => new HttpRequestMessage(HttpMethod.Get, BuildUrl(apiConfig.BaseUrl, endpoint)), cancellationToken);

    public Task<TResponse?> PostAsync<TRequest, TResponse>(
        string apiName,
        ExternalApiConfiguration apiConfig,
        string endpoint,
        TRequest payload,
        CancellationToken cancellationToken = default)
    {
        var body = JsonSerializer.Serialize(payload, JsonOptions);
        return SendJsonAsync<TResponse>(apiName, apiConfig, () => new HttpRequestMessage(HttpMethod.Post, BuildUrl(apiConfig.BaseUrl, endpoint))
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        }, cancellationToken);
    }

    /// <summary>
    /// برای Proxy فایل: Caller مسئول Dispose کردن HttpResponseMessage است.
    /// </summary>
    public async Task<HttpResponseMessage?> SendAuthorizedAsync(
        string apiName,
        ExternalApiConfiguration apiConfig,
        HttpRequestMessage request,
        string httpClientName = HttpClientSetup.InternalApiFile,
        CancellationToken cancellationToken = default)
    {
        var token = await tokenProvider.GetTokenAsync(apiName, apiConfig, cancellationToken);
        if (token is null) return null;

        if (request.RequestUri is null || !request.RequestUri.IsAbsoluteUri)
            request.RequestUri = new Uri(BuildUrl(apiConfig.BaseUrl, request.RequestUri?.ToString() ?? string.Empty));

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        try
        {
            var client = httpClientFactory.CreateClient(httpClientName);
            var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (response.StatusCode == HttpStatusCode.Unauthorized)
                tokenProvider.Invalidate(apiName, apiConfig);
            return response;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[{ApiName}] {Url} failed", apiName, request.RequestUri);
            return null;
        }
    }

    private async Task<T?> SendJsonAsync<T>(
        string apiName,
        ExternalApiConfiguration apiConfig,
        Func<HttpRequestMessage> requestFactory,
        CancellationToken cancellationToken)
    {
        for (var attempt = 1; attempt <= 2; attempt++)
        {
            var token = await tokenProvider.GetTokenAsync(apiName, apiConfig, cancellationToken);
            if (token is null) return default;

            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeoutCts.CancelAfter(TimeSpan.FromSeconds(apiConfig.TimeoutSeconds > 0 ? apiConfig.TimeoutSeconds : 10));

            using var request = requestFactory();
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

            try
            {
                var client = httpClientFactory.CreateClient(HttpClientSetup.InternalApi);
                using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeoutCts.Token);

                if (response.StatusCode == HttpStatusCode.Unauthorized)
                {
                    tokenProvider.Invalidate(apiName, apiConfig);
                    if (attempt == 1) continue;
                    logger.LogError("[{ApiName}] 401 از {Url}. معمولاً یعنی Issuer توکن با Authority آن API یکی نیست " +
                                    "(IdentityServer:IssuerUri را برابر IdentityAuthorities سامانه‌ها تنظیم کنید). WWW-Authenticate: {Header}",
                        apiName, request.RequestUri, response.Headers.WwwAuthenticate.ToString());
                    return default;
                }

                if (!response.IsSuccessStatusCode)
                {
                    logger.LogWarning("[{ApiName}] {Method} {Url} => {Status}",
                        apiName, request.Method, request.RequestUri, (int)response.StatusCode);
                    return default;
                }

                await using var stream = await response.Content.ReadAsStreamAsync(timeoutCts.Token);
                return await JsonSerializer.DeserializeAsync<T>(stream, JsonOptions, timeoutCts.Token);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (OperationCanceledException)
            {
                logger.LogWarning("[{ApiName}] {Url} بعد از {Timeout}s Timeout شد",
                    apiName, request.RequestUri, apiConfig.TimeoutSeconds);
                return default;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "[{ApiName}] {Url} failed", apiName, request.RequestUri);
                return default;
            }
        }

        return default;
    }

    /// <summary>عیب‌یابی: وضعیت توکن و پاسخ یک endpoint را با جزئیات برمی‌گرداند.</summary>
    public async Task<object> ProbeAsync(string apiName, ExternalApiConfiguration apiConfig, HttpMethod method, string endpoint, object? body, CancellationToken cancellationToken)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        string? token;
        try { token = await tokenProvider.GetTokenAsync(apiName, apiConfig, cancellationToken); }
        catch (Exception ex) { return new { api = apiName, ok = false, stage = "token", error = ex.Message, ms = sw.ElapsedMilliseconds }; }
        if (token is null)
            return new { api = apiName, ok = false, stage = "token", error = "توکن s2s دریافت نشد (لاگ را ببینید: integration / scope / discovery)", ms = sw.ElapsedMilliseconds };

        var issuer = TryReadIssuer(token);
        try
        {
            using var request = new HttpRequestMessage(method, BuildUrl(apiConfig.BaseUrl, endpoint));
            if (body is not null)
                request.Content = new StringContent(JsonSerializer.Serialize(body, JsonOptions), Encoding.UTF8, "application/json");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(TimeSpan.FromSeconds(15));
            using var response = await httpClientFactory.CreateClient(HttpClientSetup.InternalApi).SendAsync(request, timeout.Token);
            var text = await response.Content.ReadAsStringAsync(timeout.Token);
            return new
            {
                api = apiName, ok = response.IsSuccessStatusCode, stage = "request", status = (int)response.StatusCode,
                url = request.RequestUri?.ToString(), tokenIssuer = issuer,
                wwwAuthenticate = response.Headers.WwwAuthenticate.ToString(),
                bodyPreview = text.Length > 400 ? text[..400] : text, ms = sw.ElapsedMilliseconds
            };
        }
        catch (Exception ex)
        {
            return new { api = apiName, ok = false, stage = "request", tokenIssuer = issuer, error = ex.GetBaseException().Message, ms = sw.ElapsedMilliseconds };
        }
    }

    private static string? TryReadIssuer(string jwt)
    {
        try
        {
            var payload = jwt.Split('.')[1].Replace('-', '+').Replace('_', '/');
            payload = payload.PadRight(payload.Length + (4 - payload.Length % 4) % 4, '=');
            using var doc = JsonDocument.Parse(Convert.FromBase64String(payload));
            return doc.RootElement.TryGetProperty("iss", out var iss) ? iss.GetString() : null;
        }
        catch { return null; }
    }

    private static string BuildUrl(string baseUrl, string endpoint)
        => $"{baseUrl.TrimEnd('/')}/{endpoint.TrimStart('/')}";
}
