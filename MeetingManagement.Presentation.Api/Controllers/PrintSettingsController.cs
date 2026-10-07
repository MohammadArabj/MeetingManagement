using Epc.Company.Query;
using MeetingManagement.Common.Security;
using MeetingManagement.Domain.Shared.Access;
using MeetingManagement.Infrastructure.Configuration.Services;
using MeetingManagement.Presentation.Api.Filters;
using Microsoft.AspNetCore.Mvc;

namespace MeetingManagement.Presentation.Api.Controllers;

public sealed class SetPrintTemplateRequest
{
    /// <summary>شناسه فایل قالب (JSON) در سامانه مدیریت فایل؛ null = بازگشت به پیش‌فرض</summary>
    public Guid? FileGuid { get; set; }
}

/// <summary>
/// سربرگ و قالب‌های چاپ. خواندن برای همه‌ی کاربران (هر چاپی به آن نیاز دارد)؛ تغییر فقط برای
/// دارندگان دسترسی «قالب‌های چاپ» یا «تنظیمات».
/// </summary>
[Route("api/[controller]")]
[ApiController]
public sealed class PrintSettingsController(PrintSettingsService service, IActingIdentityResolver identityResolver) : ControllerBase
{
    [HttpGet]
    public async Task<Result<PrintSettingsModel>> Get(CancellationToken ct) =>
        Result<PrintSettingsModel>.Success(await service.GetAsync(ct));

    [HttpPost("Branding")]
    [RequirePermission(Permissions.PrintTemplates, Permissions.Settings)]
    public async Task<Result<bool>> SaveBranding([FromBody] PrintBranding branding, CancellationToken ct)
    {
        var identity = await identityResolver.ResolveAsync(ct);
        var error = await service.SaveBrandingAsync(branding, identity.TokenUserGuid, ct);
        return error is null ? Result<bool>.Success(true) : Result<bool>.Failure(false, error);
    }

    [HttpPost("Template/{key}")]
    [RequirePermission(Permissions.PrintTemplates, Permissions.Settings)]
    public async Task<Result<bool>> SetTemplate(string key, [FromBody] SetPrintTemplateRequest request, CancellationToken ct)
    {
        var identity = await identityResolver.ResolveAsync(ct);
        var error = await service.SetTemplateAsync(key, request.FileGuid, identity.TokenUserGuid, ct);
        return error is null ? Result<bool>.Success(true) : Result<bool>.Failure(false, error);
    }
}
