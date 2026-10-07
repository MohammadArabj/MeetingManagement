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
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Logging;
using Microsoft.IdentityModel.Tokens;
using System.IO.Compression;
using tusdotnet;
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

        // اگر Origins دارید
        if (allowedOrigins.Length > 0)
        {
            p.WithOrigins(allowedOrigins).AllowCredentials();
        }
        else
        {
            // اگر تنظیم نکردید، برای اینکه محیط Dev از کار نیفتد (ریسک امنیتی)
            p.SetIsOriginAllowed(_ => true).AllowCredentials();
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
builder.Services.AddSingleton<FileManagement.Presentation.Api.Security.SignedFileUrl>();

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

// ======== Static files: /files از FileBasePath ========
// این دقیقاً همان چیزی است که لازم دارید تا Path مثل "/files/...." مستقیم لود شود
var basePathFromConfig = builder.Configuration["FileSettings:FileBasePath"];
var contentRoot = app.Environment.ContentRootPath ?? Directory.GetCurrentDirectory();

var fileBasePath = string.IsNullOrWhiteSpace(basePathFromConfig)
    ? Path.Combine(contentRoot, "files")
    : basePathFromConfig;

if (!Path.IsPathRooted(fileBasePath))
    fileBasePath = Path.GetFullPath(Path.Combine(contentRoot, fileBasePath));

fileBasePath = Path.GetFullPath(fileBasePath);
Directory.CreateDirectory(fileBasePath);

var contentTypeProvider = new FileExtensionContentTypeProvider();
contentTypeProvider.Mappings[".pdf"] = "application/pdf";
contentTypeProvider.Mappings[".txt"] = "text/plain";
contentTypeProvider.Mappings[".csv"] = "text/csv";
contentTypeProvider.Mappings[".json"] = "application/json";
contentTypeProvider.Mappings[".xml"] = "application/xml";

// برای اینکه PDF داخل iframe بلاک نشود، CSP frame-ancestors تنظیم می‌کنیم
// اگر Angular روی Origin دیگری است، باید توی AllowedOrigins باشد
string frameAncestors = "'self'";
if (allowedOrigins.Length > 0)
    frameAncestors += " " + string.Join(" ", allowedOrigins);

// ✅ فایل‌های جلسات/مصوبات فقط با آدرس امضاشده‌ی موقت (صادرشده توسط API احرازهویت‌شده) قابل دریافت‌اند
app.UseSignedFileUrls("/files");

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(fileBasePath),
    RequestPath = "/files",
    ContentTypeProvider = contentTypeProvider,
    ServeUnknownFileTypes = false,
    OnPrepareResponse = ctx =>
    {
        // اجازه‌ی نمایش داخل iframe
        ctx.Context.Response.Headers.Remove("X-Frame-Options");
        ctx.Context.Response.Headers["Content-Security-Policy"] = $"frame-ancestors {frameAncestors};";

        // اگر فایل‌ها حساس هستند، کش را کم کنید
        ctx.Context.Response.Headers["Cache-Control"] = "private, max-age=300";
    }
});
// Static files for profile photos with protection headers
var photoPath = Path.Combine(app.Environment.WebRootPath ?? Path.Combine(contentRoot, "wwwroot"), "photo");
Directory.CreateDirectory(photoPath);

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(photoPath),
    RequestPath = "/photo",
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers["Cache-Control"] = "no-store, no-cache, must-revalidate";
        ctx.Context.Response.Headers["Pragma"] = "no-cache";
        ctx.Context.Response.Headers["Content-Disposition"] = "inline";
        // جلوگیری از embedding در سایت‌های دیگر
        ctx.Context.Response.Headers["X-Content-Type-Options"] = "nosniff";
        ctx.Context.Response.Headers["Content-Security-Policy"] = $"frame-ancestors {frameAncestors};";
    }
});
// wwwroot (اگر دارید)
app.UseStaticFiles();

// Custom middlewares
app.ConfigureExceptionHandler();
app.UseAntiXssMiddleware();

// Auth
app.UseAuthentication();
app.UseAuthorization();

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
