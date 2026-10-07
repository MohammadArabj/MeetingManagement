using Autofac;
using Autofac.Extensions.DependencyInjection;
using Epc.Autofac;
using Epc.Core;
using Fle.Infrastructure.Configuration;
using Microsoft.AspNetCore.Localization;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.IdentityModel.Logging;
using Microsoft.IdentityModel.Tokens;
using SurveyManagement.Presentation.Api;
using SurveyManagement.Presentation.Api.Services;
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
        .AddPolicy("FileManagement",
            builder => builder
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials()
                .WithOrigins(allowedOrigins)
        ));

builder.Services.AddSignalR();
builder.Services.AddScoped<IResponseExcelExportService, ResponseExcelExportService>();
builder.Services.AddScoped<ILegacyResponseDemographicMigrationService, LegacyResponseDemographicMigrationService>();
builder.Services.AddScoped<IParticipantExcelExportService, ParticipantExcelExportService>();
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
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateAudience = false,
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("SurveyManagementApi", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireClaim("scope", "SurveyApi");
    });
});

var connectionString = builder.Configuration.GetConnectionString("Application");

if (string.IsNullOrWhiteSpace(connectionString))
    throw new Exception("Please Set Connection String");

builder.Host.ConfigureContainer<ContainerBuilder>(containerBuilder =>
{
    containerBuilder.RegisterModule<EpcModule>();
    containerBuilder.RegisterModule(new SurveyManagementModule(connectionString));
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

app.UseCors("FileManagement");

app.UseAuthentication();
app.UseAuthorization();
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
app.ConfigureExceptionHandler();
app.UseAntiXssMiddleware();

app.MapControllers().RequireAuthorization("SurveyManagementApi");
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