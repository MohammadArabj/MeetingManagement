using System.Globalization;
using System.IO.Compression;
using System.Net;
using System.Text;
using Autofac;
using Autofac.Extensions.DependencyInjection;
using Epc.Application.Setting;
using Epc.Autofac;
using Epc.Core;
using Epc.Identity;
using EPC.SSO.Facades;
using EPC.SSO.Filters;
using EPC.SSO.IdentitySettings;
using EPC.SSO.Infrastructure;
using EPC.SSO.Models;
using EPC.SSO.Services;
using EPC.SSO.Validators;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Localization;
using Microsoft.AspNetCore.Mvc.Razor;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.EntityFrameworkCore;
using Microsoft.Net.Http.Headers;
using UserManagement.Domain.PermissionAgg.Services;
using UserManagement.Infrastructure.Config;
using UserManagement.Infrastructure.Persistence;
using UserManagement.Infrastructure.Services;

namespace EPC.SSO;

public class Startup(IWebHostEnvironment environment, IConfiguration configuration)
{
    public void ConfigureServices(IServiceCollection services)
    {
        var applicationConnectionString = DecodeConnectionString(configuration.GetConnectionString("Application"))
            ?? throw new InvalidOperationException("ConnectionStrings:Application تعریف نشده است.");
        var portalConnectionString = configuration.GetConnectionString("Portal")
            ?? throw new InvalidOperationException("ConnectionStrings:Portal تعریف نشده است.");

        // ─── MVC ─────────────────────────────────────────────────────────────
        // ✅ Runtime Compilation فقط در Development (در Production هر View در اولین درخواست کامپایل می‌شد).
        var mvc = services
            .AddControllersWithViews(options => options.Filters.Add<ForcePasswordChangeFilter>())
            .AddViewLocalization(LanguageViewLocationExpanderFormat.Suffix);
        if (environment.IsDevelopment())
            mvc.AddRazorRuntimeCompilation();

        // ─── Cache / Session ─────────────────────────────────────────────────
        // ✅ قبلاً SizeLimit=1024 بود و با چند صد کاربر پر می‌شد؛ از آن به بعد هیچ چیز کش نمی‌شد.
        services.AddMemoryCache(o => o.SizeLimit = configuration.GetValue("Cache:SizeLimit", 100_000));
        services.AddSingleton<IAppCache, AppCache>();
        services.AddDistributedMemoryCache();
        services.AddSession(o =>
        {
            o.Cookie.Name = ".EPC.SSO.Session";
            o.IdleTimeout = TimeSpan.FromMinutes(20);
            o.Cookie.HttpOnly = true;
            o.Cookie.IsEssential = true;
            o.Cookie.SameSite = Microsoft.AspNetCore.Http.SameSiteMode.Lax;
        });

        // ─── Data Protection (کوکی‌ها بعد از Recycle/Deploy معتبر بمانند) ─────────
        services.AddDataProtection()
            .SetApplicationName("EPC.SSO")
            .PersistKeysToFileSystem(new DirectoryInfo(SsoPaths.Combine(configuration, "dataprotection-keys")));

        // ─── IdentityServer ──────────────────────────────────────────────────
        var ids = services.AddIdentityServer(options =>
            {
                options.Events.RaiseErrorEvents = true;
                options.Events.RaiseFailureEvents = true;
                options.Events.RaiseSuccessEvents = true;
                options.Events.RaiseInformationEvents = false;

                // Issuer ثابت؛ مستقل از نامی که کاربر SSO را با آن باز کرده (IP / نام سرور / دامنه).
                var issuer = configuration["IdentityServer:IssuerUri"];
                if (!string.IsNullOrWhiteSpace(issuer))
                    options.IssuerUri = issuer;
            })
            .AddCustomTokenRequestValidator<CustomTokenRequestValidator>();

        // ✅ قبلاً services.BuildServiceProvider() داخل ConfigureServices صدا زده می‌شد (یک Container دوم
        //    با Singletonهای تکراری). حالا فقط یک DbContext موقت ساخته و Dispose می‌شود.
        using (var bootstrap = new UserManagementCommandContext(
                   new DbContextOptionsBuilder<UserManagementCommandContext>().UseSqlServer(applicationConnectionString).Options))
        {
            var tokenExpiryRaw = bootstrap.Database
                .SqlQuery<string>($"SELECT [Value] FROM [SettingDetails] AS SD JOIN [Settings] AS S ON SD.SettingId = S.Id WHERE S.[Name] = 'TokenExpiryTime'")
                .AsEnumerable()
                .FirstOrDefault();
            var tokenExpiryHours = int.TryParse(tokenExpiryRaw, out var h) && h > 0 ? h : 8;

            var allowedOrigins = configuration.GetSection("AllowedOrigins").Get<string[]>() ?? [];
            var identityConfig = new IdentityServiceConfiguration(bootstrap);
            ids.AddInMemoryIdentityResources(identityConfig.IdentityResources().ToList());
            ids.AddInMemoryApiScopes(identityConfig.ApiScopes().ToList());
            ids.AddInMemoryClients(identityConfig.Clients(tokenExpiryHours * 3600, allowedOrigins).ToList());
        }

        // ✅ کلید امضا خارج از پوشه‌ی Publish (قبلاً با هر Deploy پاک و همه‌ی توکن‌ها باطل می‌شدند).
        ids.AddDeveloperSigningCredential(persistKey: true,
            filename: configuration["IdentityServer:SigningKeyPath"] ?? SsoPaths.Combine(configuration, "signing-key.jwk"));

        services.Configure<CookiePolicyOptions>(options =>
        {
            options.CheckConsentNeeded = _ => false;
            options.MinimumSameSitePolicy = Microsoft.AspNetCore.Http.SameSiteMode.Lax;
        });
        services.AddAuthentication();

        // ─── Database ────────────────────────────────────────────────────────
        services.AddDbContextFactory<PortalDbContext>(o => o.UseSqlServer(portalConnectionString));
        services.AddScoped(sp => sp.GetRequiredService<IDbContextFactory<PortalDbContext>>().CreateDbContext());
        services.AddDbContextFactory<UserManagementCommandContext>(o => o.UseSqlServer(applicationConnectionString));

        // ─── HTTP / Infrastructure ───────────────────────────────────────────
        services.AddSsoHttpClients(configuration);
        services.AddSsoRateLimiting();
        services.AddHealthChecks();
        services.AddResponseCompression(o =>
        {
            o.EnableForHttps = true;
            o.Providers.Add<BrotliCompressionProvider>();
            o.Providers.Add<GzipCompressionProvider>();
            o.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(["image/svg+xml", "application/font-woff2"]);
        });
        services.Configure<BrotliCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);
        services.Configure<GzipCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);

        ConfigureForwardedHeaders(services);

        // ─── Application services ────────────────────────────────────────────
        services.AddTransient<IPasswordHasher, PasswordHasher>();
        services.AddScoped<IPasswordValidator, PasswordValidator>();
        services.AddScoped<IIpAccessRestrictionService, IpAccessRestrictionService>();
        services.AddScoped<IUserPortalQueryFacade, UserPortalQueryFacade>();
        services.AddScoped<ISystemIntegrationQueryFacade, SystemIntegrationQueryFacade>();

        services.AddSingleton<S2STokenProvider>();
        services.AddScoped<ExternalApiClientService>();
        services.AddScoped<AnnouncementApiService>();
        services.AddScoped<SurveyApiService>();
        services.AddScoped<MeetingApiService>();
        services.AddScoped<PhoneDirectoryApiService>();
        services.AddScoped<KaajDocumentApiService>();
        services.AddScoped<SmsApiService>();
        services.AddScoped<FarzinApiService>();
        services.AddScoped<SuggestionService>();
        services.AddScoped<OtherProgramService>();
        services.AddScoped<WindowsProgramService>();

        services.AddSingleton<AnnouncementFileCache>();
        services.AddSingleton<LoginAnnouncementStore>();
        services.AddHostedService<LoginAnnouncementRefreshService>();
        services.AddHostedService<ExternalApiWarmupService>();

        // ─── اعلان لحظه‌ای پرتال (دریافت از سامانه‌ها با امضای HMAC و ارسال با SignalR) ───
        services.AddSignalR();
        services.AddSingleton<EPC.SSO.Realtime.PortalCacheVersions>();

        if (environment.IsDevelopment())
            services.AddDatabaseDeveloperPageExceptionFilter();
    }

    public void ConfigureContainer(ContainerBuilder container)
    {
        container.RegisterModule<EpcModule>();
        container.RegisterModule(new UserManagementModule(
            DecodeConnectionString(configuration.GetConnectionString("Application"))
            ?? throw new InvalidOperationException("Connection string 'Application' is not configured.")));

        // تنظیمات سیستم ۶۰ ثانیه کش می‌شوند (SettingService فریم‌ورک در هر Fetch به دیتابیس می‌رود)
        container.RegisterDecorator<CachedSettingService, ISettingService>();
    }

    public void Configure(IApplicationBuilder app)
    {
        ServiceLocator.SetCurrent(new AutofacServiceLocator(app.ApplicationServices.GetAutofacRoot()));

        var fa = new CultureInfo("fa-IR");
        CultureInfo.DefaultThreadCurrentCulture = fa;
        CultureInfo.DefaultThreadCurrentUICulture = fa;

        if (configuration.GetSection("ReverseProxy:KnownProxies").Get<string[]>() is { Length: > 0 })
            app.UseForwardedHeaders();

        if (environment.IsDevelopment())
            app.UseDeveloperExceptionPage();
        else
            app.UseExceptionHandler("/Home/Error");

        app.UseResponseCompression();
        app.UseStaticFiles(new StaticFileOptions
        {
            OnPrepareResponse = ctx =>
            {
                // فایل‌های نسخه‌دار (asp-append-version → ?v=) یک سال، بقیه یک روز
                var versioned = ctx.Context.Request.Query.ContainsKey("v");
                ctx.Context.Response.Headers[HeaderNames.CacheControl] = versioned
                    ? "public, max-age=31536000, immutable"
                    : "public, max-age=86400";
            }
        });

        app.UseRouting();
        app.UseRequestLocalization(new RequestLocalizationOptions
        {
            DefaultRequestCulture = new RequestCulture(fa),
            SupportedCultures = [fa],
            SupportedUICultures = [fa]
        });
        app.UseCookiePolicy();
        app.UseSession();
        app.UseIdentityServer();
        app.UseAuthorization();
        app.UseRateLimiter();
        app.UseAntiXssMiddleware();

        app.UseEndpoints(endpoints =>
        {
            endpoints.MapHealthChecks("/health");
            endpoints.MapControllers();
            endpoints.MapHub<EPC.SSO.Realtime.PortalHub>(EPC.SSO.Realtime.PortalHub.Path);
            endpoints.MapControllerRoute("default", "{controller=Account}/{action=Login}/{id?}");
        });
    }

    private void ConfigureForwardedHeaders(IServiceCollection services)
    {
        var proxies = configuration.GetSection("ReverseProxy:KnownProxies").Get<string[]>() ?? [];
        services.Configure<ForwardedHeadersOptions>(o =>
        {
            o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            o.KnownProxies.Clear();
            o.KnownNetworks.Clear();
            foreach (var p in proxies)
                if (IPAddress.TryParse(p, out var ip)) o.KnownProxies.Add(ip);
        });
    }

    private static string? DecodeConnectionString(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return value.Contains("Server", StringComparison.OrdinalIgnoreCase)
            ? value
            : Encoding.UTF8.GetString(Convert.FromBase64String(value));
    }
}
