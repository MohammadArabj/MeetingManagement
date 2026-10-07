using Epc.Company.Query;
using MeetingManagement.Domain.Shared.Access;
using MeetingManagement.Infrastructure.Configuration.Notifications;
using Microsoft.AspNetCore.Mvc;

namespace MeetingManagement.Presentation.Api.Controllers;

public sealed class AlarmListModel
{
    public List<AlarmModel> Items { get; set; } = [];
    public int Unread { get; set; }
}

/// <summary>اعلان‌های داخل سامانه برای سمت فعال کاربر (زنگوله هدر).</summary>
[Route("api/[controller]")]
[ApiController]
public class AlarmController(NotificationAdminService service, IActingIdentityResolver identityResolver) : ControllerBase
{
    [HttpGet("Mine")]
    public async Task<Result<AlarmListModel>> Mine([FromQuery] bool onlyUnread = false, [FromQuery] int take = 20, CancellationToken ct = default)
    {
        var identity = await identityResolver.ResolveAsync(ct);
        if (identity.PositionGuid is not { } position)
            return Result<AlarmListModel>.Success(new AlarmListModel());

        var (items, unread) = await service.GetAlarmsAsync(position, onlyUnread, take, ct);
        return Result<AlarmListModel>.Success(new AlarmListModel { Items = items, Unread = unread });
    }

    [HttpPost("MarkRead/{id:int}")]
    public async Task<Result<bool>> MarkRead(int id, CancellationToken ct)
    {
        var identity = await identityResolver.ResolveAsync(ct);
        if (identity.PositionGuid is { } position) await service.MarkReadAsync(position, id, ct);
        return Result<bool>.Success(true);
    }

    [HttpPost("MarkAllRead")]
    public async Task<Result<bool>> MarkAllRead(CancellationToken ct)
    {
        var identity = await identityResolver.ResolveAsync(ct);
        if (identity.PositionGuid is { } position) await service.MarkReadAsync(position, null, ct);
        return Result<bool>.Success(true);
    }
}
