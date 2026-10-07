using System.Collections.Concurrent;
using System.Net;
using System.Net.Security;
using System.Net.Sockets;
using System.Security.Cryptography.X509Certificates;
using EPC.SSO.Services;

namespace EPC.SSO.Infrastructure;

/// <summary>
/// ثبت HttpClientها با تنظیمات مناسب شبکه‌ی داخلی و ویندوز سرور.
///
/// چرا؟ سه علت رایج «کندی ۲ تا ۱۵ ثانیه‌ای» در تماس‌های سرور‌به‌سرور روی ویندوز:
///  ۱) localhost ابتدا به ‎::1 (IPv6) resolve می‌شود. اگر سرویس مقصد فقط روی IPv4 گوش
///     بدهد، ویندوز برای هر تلاش ناموفق TCP حدود ۲ ثانیه SYN را تکرار می‌کند و بعد
///     سراغ 127.0.0.1 می‌رود. ConnectCallback زیر IPv4 را مقدم می‌کند.
///  ۲) Resolve نام‌های NetBIOS/DNS کند (مثل PLN-www10). نتایج DNS اینجا ۵ دقیقه کش
///     می‌شود و در صورت قطعی DNS، آخرین IP معتبر استفاده می‌شود.
///  ۳) ConnectTimeout پیش‌فرض بی‌نهایت است؛ یعنی اگر مقصد جواب ندهد، تا Timeout کل
///     درخواست صبر می‌شود. اینجا اتصال حداکثر ۳ ثانیه و هر IP حداکثر ۲ ثانیه.
/// </summary>
public static class HttpClientSetup
{
    public const string IdentityServerClient = "IdentityServerClient";
    public const string InternalApi = "InternalApi";
    public const string InternalApiFile = "InternalApiFile";
    public const string FarzinClient = "FarzinClient";
    public const string SmsClient = "SmsClient";

    public static IServiceCollection AddSsoHttpClients(this IServiceCollection services, IConfiguration configuration)
    {
        // ⚠️ فقط برای سرویس‌هایی که گواهی Self-signed دارند. لیست در appsettings:
        //    "Http": { "AcceptAnyCertificateClients": [ "FarzinClient", "SmsClient" ] }
        // پیش‌فرض خالی است (قبلاً بدون تنظیم، گواهی SMS و فرزین بررسی نمی‌شد و رمزهای موقت در معرض MITM بودند).
        // امن‌تر: به جای پذیرش هر گواهی، Thumbprint گواهی همان سرویس را ثابت کنید:
        //    "Http": { "PinnedCertificates": { "SmsClient": "<SHA1 thumbprint>" } }
        var acceptAny = configuration.GetSection("Http:AcceptAnyCertificateClients").Get<string[]>() ?? [];
        var pinned = configuration.GetSection("Http:PinnedCertificates").GetChildren()
            .Where(c => !string.IsNullOrWhiteSpace(c.Value))
            .ToDictionary(c => c.Key, c => c.Value!.Replace(" ", "").Replace(":", ""), StringComparer.OrdinalIgnoreCase);
        SslMode Mode(string client) => pinned.TryGetValue(client, out var thumb)
            ? new SslMode(false, thumb)
            : new SslMode(acceptAny.Contains(client, StringComparer.OrdinalIgnoreCase), null);

        services.AddHttpClient(IdentityServerClient, c => c.Timeout = TimeSpan.FromSeconds(10))
            .ConfigurePrimaryHttpMessageHandler(() => CreateHandler(Mode(IdentityServerClient)));

        services.AddHttpClient(InternalApi, c => c.Timeout = TimeSpan.FromSeconds(15))
            .ConfigurePrimaryHttpMessageHandler(() => CreateHandler(Mode(InternalApi)));

        // انتقال فایل: Timeout کلی نداریم؛ لغو با RequestAborted/CancellationToken کنترل می‌شود.
        services.AddHttpClient(InternalApiFile, c => c.Timeout = Timeout.InfiniteTimeSpan)
            .ConfigurePrimaryHttpMessageHandler(() => CreateHandler(Mode(InternalApiFile)));

        services.AddHttpClient(FarzinClient, c => c.Timeout = TimeSpan.FromSeconds(15))
            .ConfigurePrimaryHttpMessageHandler(() => CreateHandler(Mode(FarzinClient)));

        services.AddHttpClient(SmsClient, c => c.Timeout = TimeSpan.FromSeconds(15))
            .ConfigurePrimaryHttpMessageHandler(() => CreateHandler(Mode(SmsClient)));

        // کلاینت پیش‌فرض (KaajDocumentApiService از CreateClient() بدون نام استفاده می‌کند)
        services.AddHttpClient(Microsoft.Extensions.Options.Options.DefaultName)
            .ConfigurePrimaryHttpMessageHandler(() => CreateHandler(default));

        // ✅ قبلاً ManagementSystemsApiService با AddScoped ثبت شده بود و HttpClient بدون BaseAddress
        //    دریافت می‌کرد؛ چون endpointها نسبی هستند، همه‌ی درخواست‌ها Exception می‌دادند و
        //    صفحه‌ی سیستم‌های مدیریتی همیشه خالی بود.
        services.AddHttpClient<ManagementSystemsApiService>(c =>
            {
                var baseUrl = configuration["ManagementSystemsApi:BaseUrl"];
                if (!string.IsNullOrWhiteSpace(baseUrl))
                    c.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");
                c.Timeout = TimeSpan.FromSeconds(15);
            })
            .ConfigurePrimaryHttpMessageHandler(() => CreateHandler(Mode("ManagementSystemsApi")));

        return services;
    }

    private readonly record struct SslMode(bool AcceptAny, string? PinnedThumbprint);

    private static SocketsHttpHandler CreateHandler(SslMode mode)
    {
        var ssl = new SslClientAuthenticationOptions
        {
            // شبکه‌ی داخلی معمولاً به CRL/OCSP اینترنتی دسترسی ندارد؛ بررسی Revocation
            // در این حالت هر اتصال TLS را تا Timeout (حدود ۱۵ ثانیه) معطل می‌کند.
            CertificateRevocationCheckMode = X509RevocationMode.NoCheck
        };

        if (mode.PinnedThumbprint is { } thumbprint)
            ssl.RemoteCertificateValidationCallback = (_, cert, _, errors) =>
                errors == System.Net.Security.SslPolicyErrors.None ||
                string.Equals(cert?.GetCertHashString(), thumbprint, StringComparison.OrdinalIgnoreCase);
        else if (mode.AcceptAny)
            ssl.RemoteCertificateValidationCallback = static (_, _, _, _) => true;

        return new SocketsHttpHandler
        {
            PooledConnectionLifetime = TimeSpan.FromMinutes(10),
            PooledConnectionIdleTimeout = TimeSpan.FromMinutes(5),
            ConnectTimeout = TimeSpan.FromSeconds(3),
            MaxConnectionsPerServer = 512,
            AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate | DecompressionMethods.Brotli,
            EnableMultipleHttp2Connections = true,
            UseCookies = false,
            SslOptions = ssl,
            ConnectCallback = ConnectPreferIPv4Async
        };
    }

    private static async ValueTask<Stream> ConnectPreferIPv4Async(
        SocketsHttpConnectionContext context,
        CancellationToken cancellationToken)
    {
        var endpoint = context.DnsEndPoint;
        var addresses = await DnsCache.ResolveAsync(endpoint.Host, cancellationToken);

        Exception? lastError = null;
        foreach (var address in addresses)
        {
            var socket = new Socket(address.AddressFamily, SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
            using var perAddressCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            perAddressCts.CancelAfter(TimeSpan.FromSeconds(2));
            try
            {
                await socket.ConnectAsync(new IPEndPoint(address, endpoint.Port), perAddressCts.Token);
                return new NetworkStream(socket, ownsSocket: true);
            }
            catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
            {
                socket.Dispose();
                lastError = ex;
            }
            catch
            {
                socket.Dispose();
                throw;
            }
        }

        throw lastError ?? new SocketException((int)SocketError.HostNotFound);
    }

    private static class DnsCache
    {
        private static readonly ConcurrentDictionary<string, (IPAddress[] Addresses, DateTime ExpiresUtc)> Cache =
            new(StringComparer.OrdinalIgnoreCase);

        private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(5);

        public static async ValueTask<IPAddress[]> ResolveAsync(string host, CancellationToken cancellationToken)
        {
            if (IPAddress.TryParse(host, out var literal))
                return [literal];

            if (string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase))
                return [IPAddress.Loopback, IPAddress.IPv6Loopback];

            if (Cache.TryGetValue(host, out var cached) && cached.ExpiresUtc > DateTime.UtcNow)
                return cached.Addresses;

            try
            {
                var resolved = await Dns.GetHostAddressesAsync(host, cancellationToken);
                var ordered = resolved
                    .OrderBy(a => a.AddressFamily == AddressFamily.InterNetwork ? 0 : 1)
                    .ToArray();

                if (ordered.Length > 0)
                    Cache[host] = (ordered, DateTime.UtcNow.Add(Ttl));

                return ordered;
            }
            catch when (cached.Addresses is { Length: > 0 })
            {
                // DNS در دسترس نیست → آخرین IP معتبر
                return cached.Addresses;
            }
        }
    }
}
