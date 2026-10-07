using Autofac;
using Autofac.Extensions.DependencyInjection;
using Epc.Autofac;
using Epc.Core;
using FileManagement.Common;
using FileManagement.Infrastructure.Configuration;
using FileManagement.Infrastructure.Tus;
using FileManagement.Presentation.Api;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.IdentityModel.Logging;
using Microsoft.IdentityModel.Tokens;
using System.IO.Compression;
using tusdotnet;
using FileManagement.Presentation.Api.Media;
using FileManagement.Presentation.Api.Security;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseServiceProviderFactory(new AutofacServiceProviderFactory());

builder.Services.AddRazorPages();
builder.Services.AddControllers().AddNewtonsoftJson();
builder.Services.AddSignalR();
builder.Services.AddHttpContextAccessor();
builder.Services.AddLogging();

// Compression
builder.Services.Configure<GzipCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);
builder.Services.AddResponseCompression(o =>
{
    o.EnableForHttps = true;
    o.Providers.Add<GzipCompressionProvider>();
});

// Auth
var authorities = builder.Configuration.GetSection("IdentityAuthorities");
builder.Services.AddAuthentication("Bearer")
    .AddJwtBearer("Bearer", options =>
    {
        options.RequireHttpsMetadata = false;
        options.Authority = authorities["0"];
        options.TokenValidationParameters = new TokenValidationParameters { ValidateAudience = false };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("FileManagementApi", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireClaim("scope", "FileManagementApi");
    });
});

// CORS (حتماً Policy را همیشه بسازید تا UseCors خطا ندهد)
var allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("FileManagement", p =>
    {
        p.AllowAnyHeader()
         .AllowAnyMethod()
         .WithExposedHeaders(
            "Upload-Offset",
            "Upload-Length",
            "Location",
            "Tus-Resumable",
            "Tus-Version",
            "Tus-Extension",
            "Tus-Max-Size",
            "Upload-Metadata");

        if (allowedOrigins.Length > 0)
        {
            p.WithOrigins(allowedOrigins).AllowCredentials();
        }
        else if (builder.Environment.IsDevelopment())
        {
            // فقط در محیط توسعه: هر مبدأ مجاز (در Production بدون AllowedOrigins هیچ مبدأیی مجاز نیست)
            p.SetIsOriginAllowed(_ => true).AllowCredentials();
        }
        else
        {
            p.SetIsOriginAllowed(_ => false);
        }
    });
});

// Large uploads
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 5L * 1024 * 1024 * 1024; // 5GB
    options.Limits.MinRequestBodyDataRate = new Microsoft.AspNetCore.Server.Kestrel.Core.MinDataRate(100, TimeSpan.FromSeconds(10));
    options.Limits.KeepAliveTimeout = TimeSpan.FromMinutes(30);
    options.Limits.RequestHeadersTimeout = TimeSpan.FromMinutes(5);
});

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 5L * 1024 * 1024 * 1024; // 5GB
    options.ValueLengthLimit = int.MaxValue;
    options.MultipartHeadersLengthLimit = int.MaxValue;
});

// Autofac modules
var connectionString = builder.Configuration.GetConnectionString("Application");
if (string.IsNullOrWhiteSpace(connectionString))
    throw new Exception("Please Set Connection String");

builder.Host.ConfigureContainer<ContainerBuilder>(containerBuilder =>
{
    containerBuilder.RegisterModule<EpcModule>();
    containerBuilder.RegisterModule(new FileManagementModule(connectionString));
});
builder.Services.AddTusServices(builder.Configuration);
// امضای آدرس فایل‌ها، دسترسی عکس/امضا، بندانگشتی‌ها و پاک‌سازی کش
builder.Services.AddSingleton<SignedFileUrl>();
builder.Services.AddSingleton<MediaAccess>();
builder.Services.AddSingleton<ImageThumbnailService>();
builder.Services.AddSingleton(_ => new MediaResponses(
    string.Join(" ", new[] { "'self'" }.Concat(allowedOrigins))));
builder.Services.AddHostedService<MediaCacheSweeper>();

var app = builder.Build();

// ServiceLocator
var autofacContainer = app.Services.GetAutofacRoot();
ServiceLocator.SetCurrent(new AutofacServiceLocator(autofacContainer));

// ======== Exception pages ========
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    IdentityModelEventSource.ShowPII = true;
}
else
{
    app.UseHsts();
}

// Compression
app.UseResponseCompression();

// HTTPS + Routing
app.UseHttpsRedirection();
app.UseRouting();

// CORS (برای API + Static files هم اعمال شود)
app.UseCors("FileManagement");

// ======== فایل‌ها ========
// هیچ پوشه‌ای به‌صورت Static عمومی سرو نمی‌شود (wwwroot شامل امضاها/عکس‌ها/آپلودهای نیمه‌کاره بود).
// پیوست‌ها، امضاها و عکس‌ها فقط از MediaEndpoints با آدرس امضاشده/توکن سرو می‌شوند.
if (app.Environment.IsDevelopment())
{
    var locations = app.Services.GetRequiredService<FileStorageLocations>();
    app.Logger.LogInformation("Storage — files: {Files} | photos: {Photos} | signatures: {Signatures} | cache: {Cache}",
        locations.FilesRoot, locations.PhotosRoot, locations.SignaturesRoot, locations.CacheRoot);
}

// Custom middlewares
app.ConfigureExceptionHandler();
app.UseAntiXssMiddleware();

// Auth
app.UseAuthentication();
app.UseAuthorization();

// فایل‌ها، امضا و عکس (هرکدام کنترل دسترسی خودش را دارد)
app.MapMediaEndpoints();

// Controllers (secured)
app.MapControllers().RequireAuthorization("FileManagementApi");

// TUS endpoint (secured)
app.MapTus("/api/Upload/tus", async httpContext =>
{
    var sp = httpContext.RequestServices;
    return TusConfiguration.GetTusConfiguration(sp, httpContext);
}).RequireAuthorization("FileManagementApi");

app.MapRazorPages();
app.MapDefaultControllerRoute();

app.Run();
