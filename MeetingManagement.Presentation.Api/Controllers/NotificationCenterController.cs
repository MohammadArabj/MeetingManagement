using Epc.Company.Query;
using MeetingManagement.Infrastructure.Configuration.Notifications;
using MeetingManagement.Presentation.Api.Filters;
using Microsoft.AspNetCore.Mvc;

namespace MeetingManagement.Presentation.Api.Controllers;

/// <summary>تنظیمات اطلاع‌رسانی: رویدادها، قالب‌ها، لاگ ارسال، پیامک آزمایشی.</summary>
[Route("api/[controller]")]
[ApiController]
[RequirePermission("MT_Settings")]
public class NotificationCenterController(NotificationAdminService service) : ControllerBase
{
    [HttpGet("Events")]
    public async Task<Result<List<NotificationEventModel>>> Events(CancellationToken ct) =>
        Result<List<NotificationEventModel>>.Success(await service.GetEventsAsync(ct));

    [HttpPost("Events/Update")]
    public async Task<Result<bool>> UpdateEvent([FromBody] UpdateEventSettingModel model, CancellationToken ct)
    {
        var error = await service.UpdateEventSettingAsync(model, ct);
        return error is null ? Result<bool>.Success(true) : Result<bool>.Failure(false, error);
    }

    [HttpGet("Placeholders")]
    public Result<IReadOnlyDictionary<string, string>> Placeholders() =>
        Result<IReadOnlyDictionary<string, string>>.Success(NotificationAdminService.Placeholders);

    [HttpPost("Templates/Save")]
    public async Task<Result<int>> SaveTemplate([FromBody] SaveTemplateModel model, CancellationToken ct)
    {
        var (id, error) = await service.SaveTemplateAsync(model, ct);
        return error is null ? Result<int>.Success(id) : Result<int>.Failure(0, error);
    }

    [HttpPost("Templates/Delete/{id:int}")]
    public async Task<Result<bool>> DeleteTemplate(int id, CancellationToken ct)
    {
        var error = await service.DeleteTemplateAsync(id, ct);
        return error is null ? Result<bool>.Success(true) : Result<bool>.Failure(false, error);
    }

    [HttpPost("Templates/Preview")]
    public Result<TemplatePreviewResult> Preview([FromBody] TemplatePreviewModel model) =>
        Result<TemplatePreviewResult>.Success(service.Preview(model));

    [HttpPost("Logs")]
    public async Task<Result<NotificationLogPage>> Logs([FromBody] NotificationLogSearchModel search, CancellationToken ct) =>
        Result<NotificationLogPage>.Success(await service.SearchLogsAsync(search, ct));

    [HttpPost("Logs/Resend/{id:long}")]
    public async Task<Result<bool>> Resend(long id, CancellationToken ct)
    {
        var error = await service.ResendAsync(id, ct);
        return error is null ? Result<bool>.Success(true) : Result<bool>.Failure(false, error);
    }

    [HttpPost("TestSms")]
    public async Task<Result<bool>> TestSms([FromBody] TestSmsModel model, CancellationToken ct)
    {
        var result = await service.SendTestSmsAsync(model, ct);
        return result.Success
            ? Result<bool>.Success(true)
            : Result<bool>.Failure(false, result.Error ?? "ارسال ناموفق بود.");
    }
}
