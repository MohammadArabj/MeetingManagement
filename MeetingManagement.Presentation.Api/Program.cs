using Autofac;
using Autofac.Extensions.DependencyInjection;
using Epc.Autofac;
using Epc.Core;
using MeetingManagement.Application.Services;
using MeetingManagement.Infrastructure.Configuration;
using MeetingManagement.Infrastructure.Configuration.Job;
using MeetingManagement.Infrastructure.Configuration.Notifications;
using MeetingManagement.Infrastructure.Configuration.Service;
using MeetingManagement.Presentation.Api;
using MeetingManagement.Presentation.Api.Filters;
using MeetingManagement.Presentation.Api.Realtime;
using MeetingManagement.Domain.Shared.Notifications;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using MeetingManagement.Infrastructure.Configuration.Services;
using Microsoft.AspNetCore.Localization;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.IdentityModel.Logging;
using Microsoft.IdentityModel.Tokens;
using System.Globalization;
using System.IO.Compression;

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseServiceProviderFactory(new AutofacServiceProviderFactory());

// ═══════════════════════════════════════════════════════════
// Services
// ═══════════════════════════════════════════════════════════
builder.Services.AddRazorPages();
builder.Services.AddSwaggerGen();
builder.Services.AddLogging();
builder.Services.AddMemoryCache();
builder.Services.AddHttpContextAccessor();

builder.Services.Configure<GzipCompressionProviderOptions>(options => options.Level = CompressionLevel.Fastest);
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<GzipCompressionProvider>();
});

// ✅ HttpClient های نام‌دار (به‌جای new HttpClient/RestClient در هر درخواست)
builder.Services.AddHttpClient(HttpSmsSender.HttpClientName, c => c.Timeout = TimeSpan.FromSeconds(15));
builder.Services.AddHttpClient(nameof(ServiceTokenProvider), c => c.Timeout = TimeSpan.FromSeconds(15));
builder.Services.AddHttpClient(ActingIdentityResolver.HttpClientName, c => c.Timeout = TimeSpan.FromSeconds(10));

var allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options => options.AddPolicy("FileManagement", policy => policy
    .WithOrigins(allowedOrigins)
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

// ═══ اعلان لحظه‌ای (SignalR + ارسال به پرتال SSO) ═══
builder.Services.AddSignalR();
builder.Services.AddSingleton<SsoRealtimeRelay>();
builder.Services.AddSingleton<IRealtimeBroadcaster, RealtimeBroadcaster>();
builder.Services.AddHostedService<SsoRealtimeRelayWorker>();
builder.Services.AddHttpClient(SsoRealtimeRelayWorker.HttpClientName, c => c.Timeout = TimeSpan.FromSeconds(10));
// ✅ مقادیر «کاربر/سمت فراخوان» در مدل‌های ورودی همیشه از هویت راستی‌آزمایی‌شده پر می‌شوند
builder.Services.AddControllers(options =>
{
    options.Filters.Add<CallerIdentityFilter>();
    options.Filters.Add<RealtimeFlushFilter>();
}).AddNewtonsoftJson();

// فایل‌ها با tus مستقیماً در سامانه مدیریت فایل آپلود می‌شوند؛ این API فقط درخواست‌های کوچک می‌پذیرد.
// سقف پیش‌فرض سرور (۳۰ مگابایت) حفظ می‌شود و endpointهای فرم در صورت نیاز با [RequestSizeLimit] مشخص می‌شوند.

var authorities = builder.Configuration.GetSection("IdentityAuthorities");
builder.Services.AddAuthentication("Bearer")
    .AddJwtBearer("Bearer", options =>
    {
        // شبکه داخلی بدون HTTPS؛ در صورت فعال شدن HTTPS در SSO مقدار را true کنید
        options.RequireHttpsMetadata = builder.Configuration.GetValue("Auth:RequireHttpsMetadata", false);
        options.Authority = authorities["0"];
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateAudience = false,
            ClockSkew = TimeSpan.FromMinutes(1),
        };
        // WebSocket مرورگر هدر Authorization ندارد؛ برای Hub توکن از Query String خوانده می‌شود
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var token = context.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token) && context.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                    context.Token = token;
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("FileManagementApi", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireClaim("scope", "MeetApi");
    });
});

var connectionString = builder.Configuration.GetConnectionString("Application");
if (string.IsNullOrWhiteSpace(connectionString))
    throw new Exception("Please Set Connection String");

builder.Host.ConfigureContainer<ContainerBuilder>(containerBuilder =>
{
    containerBuilder.RegisterModule<EpcModule>();
    containerBuilder.RegisterModule(new MeetingManagementModule(connectionString));
});

builder.Services.AddScoped<ISystemSettingInitializationService, SettingInitializationService>();
builder.Services.AddQuartzJobs();

// ═══════════════════════════════════════════════════════════
// App
// ═══════════════════════════════════════════════════════════
var app = builder.Build();
ServiceLocator.SetCurrent(new AutofacServiceLocator(app.Services.GetAutofacRoot()));

CultureInfo.DefaultThreadCurrentCulture = new CultureInfo("fa-IR");
CultureInfo.DefaultThreadCurrentUICulture = new CultureInfo("fa-IR");

// تنظیمات + Seed نقش‌ها/رویدادها (فقط داده؛ بدون تغییر اسکیما)
using (var scope = app.Services.CreateScope())
{
    var settingService = scope.ServiceProvider.GetRequiredService<ISystemSettingInitializationService>();
    await settingService.SeedDefaultSettingsAsync();
    await settingService.InitializeAsync();
}

// ✅ Exception handler باید اولین middleware باشد تا خطای همه لایه‌ها را بگیرد
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    IdentityModelEventSource.ShowPII = true; // ⚠️ فقط در محیط توسعه
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    app.ConfigureExceptionHandler();
}

app.UseRequestLocalization(new RequestLocalizationOptions
{
    DefaultRequestCulture = new RequestCulture("fa-IR"),
    SupportedCultures = [new CultureInfo("fa-IR")],
    SupportedUICultures = [new CultureInfo("fa-IR")],
});

app.UseResponseCompression();
app.UseStaticFiles();
app.UseHttpsRedirection();
app.UseRouting();
app.UseCors("FileManagement");
app.UseAuthentication();
app.UseAuthorization();
app.UseAntiXssMiddleware();

app.MapControllers().RequireAuthorization("FileManagementApi");
app.MapHub<NotificationsHub>(NotificationsHub.Path);
app.MapRazorPages();
app.MapDefaultControllerRoute();

app.Run();
