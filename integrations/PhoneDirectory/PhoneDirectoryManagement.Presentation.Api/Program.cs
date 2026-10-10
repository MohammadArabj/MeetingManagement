using Autofac;
using Autofac.Extensions.DependencyInjection;
using Epc.Autofac;
using Epc.Core;
using PhoneDirectoryManagement.Infrastructure.Configuration;
using PhoneDirectoryManagement.Presentation.Api;
using Microsoft.AspNetCore.Localization;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.IdentityModel.Logging;
using Microsoft.IdentityModel.Tokens;
using System.Globalization;
using System.IO.Compression;

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseServiceProviderFactory(new AutofacServiceProviderFactory());

builder.Services.AddRazorPages();
builder.Services.AddSwaggerGen();

builder.Services.AddLogging();
builder.Services.AddRazorPages();
builder.Services.Configure<GzipCompressionProviderOptions>
    (options => options.Level = CompressionLevel.Fastest);

builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<GzipCompressionProvider>();
});

builder.Services.AddHttpContextAccessor();

var allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>();

if (allowedOrigins is not null)
    builder.Services.AddCors(options => options
        .AddPolicy("Announcement",
            builder => builder
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials()
                .WithOrigins(allowedOrigins)
        ));

builder.Services.AddSignalR();

builder.Services.AddControllers().AddNewtonsoftJson();
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 524288000;
});
var authorities = builder.Configuration.GetSection("IdentityAuthorities");

builder.Services.AddAuthentication("Bearer")
    .AddJwtBearer("Bearer", options =>
    {
        options.RequireHttpsMetadata = false;
        options.Authority = authorities["0"];
        options.MapInboundClaims = false;

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateAudience = false,
        };

        //options.Events = new JwtBearerEvents
        //{
        //    OnAuthenticationFailed = context =>
        //    {
        //        Console.WriteLine("AUTH FAILED:");
        //        Console.WriteLine(context.Exception.ToString());
        //        return Task.CompletedTask;
        //    },

        //    OnTokenValidated = context =>
        //    {
        //        Console.WriteLine("TOKEN VALIDATED");
        //        return Task.CompletedTask;
        //    },

        //    OnChallenge = context =>
        //    {
        //        Console.WriteLine($"CHALLENGE: {context.Error}");
        //        Console.WriteLine(context.ErrorDescription);
        //        return Task.CompletedTask;
        //    }
        //};
    });
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("PhoneDirectoryApi", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireClaim("scope", "PhoneDirectoryApi");
    });
});

var connectionString = builder.Configuration.GetConnectionString("Application");

if (string.IsNullOrWhiteSpace(connectionString))
    throw new Exception("Please Set Connection String");

builder.Host.ConfigureContainer<ContainerBuilder>(containerBuilder =>
{
    containerBuilder.RegisterModule<EpcModule>();
    containerBuilder.RegisterModule(new PhoneDirectoryManagementModule(connectionString));
});

var app = builder.Build();
var autofacContainer = app.Services.GetAutofacRoot();
ServiceLocator.SetCurrent(new AutofacServiceLocator(autofacContainer));

app.UseResponseCompression();

app.UseStaticFiles();
app.UseDeveloperExceptionPage();
IdentityModelEventSource.ShowPII = true;

app.UseHttpsRedirection();

app.UseRouting();

app.UseCors("Announcement");

app.UseAuthentication();
app.UseAuthorization();
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
app.ConfigureExceptionHandler();
app.UseAntiXssMiddleware();

app.MapControllers();
app.MapRazorPages();
app.MapDefaultControllerRoute();

CultureInfo.DefaultThreadCurrentCulture = new CultureInfo("fa-IR");
CultureInfo.DefaultThreadCurrentUICulture = new CultureInfo("fa-IR");

app.UseRequestLocalization(new RequestLocalizationOptions
{
    DefaultRequestCulture = new RequestCulture("fa-IR"),
    SupportedCultures = new List<CultureInfo> { new("fa-IR") },
    SupportedUICultures = new List<CultureInfo> { new("fa-IR") },

});
app.Run();