using Epc.Company.Query;
using MeetingManagement.Domain.Shared.Access;
using MeetingManagement.Infrastructure.Configuration.Services;
using MeetingManagement.Presentation.Api.Filters;
using Microsoft.AspNetCore.Mvc;

namespace MeetingManagement.Presentation.Api.Controllers;

/// <summary>
/// دسترسی کاربر روی جلسه + پیکربندی نقش‌ها.
/// فرانت به‌جای تصمیم‌گیری با roleId، توانایی‌ها را از این API می‌گیرد.
/// </summary>
[Route("api/[controller]")]
[ApiController]
public class MeetingAccessController(
    IMeetingAccessService accessService,
    MeetingRoleConfigService roleConfigService,
    ICurrentUser currentUser) : ControllerBase
{
    /// <summary>توانایی‌های کاربر جاری در یک جلسه</summary>
    [HttpGet("{meetingGuid:guid}")]
    public async Task<Result<MeetingAccessModel>> Get(Guid meetingGuid, CancellationToken ct)
    {
        var access = await accessService.GetAsync(meetingGuid, ct);
        return access.Exists
            ? Result<MeetingAccessModel>.Success(MeetingAccessModel.From(access))
            : Result<MeetingAccessModel>.Failure(MeetingAccessModel.From(access), "جلسه یافت نشد.");
    }

    /// <summary>پیکربندی نقش‌ها (عمومی برای همه کاربران؛ فرانت برای نمایش نقش‌ها لازم دارد)</summary>
    [HttpGet("RoleConfig")]
    public async Task<Result<RoleConfigModel>> GetRoleConfig(CancellationToken ct) =>
        Result<RoleConfigModel>.Success(await roleConfigService.GetAsync(ct));

    [HttpPost("RoleConfig")]
    [RequirePermission("MT_UserRoles", "MT_Settings")]
    public async Task<Result<bool>> SaveRoleConfig([FromBody] List<RoleDefinitionModel> roles, CancellationToken ct)
    {
        var (ok, errors) = await roleConfigService.SaveAsync(roles, currentUser.UserGuid, ct);
        return ok ? Result<bool>.Success(true) : Result<bool>.Failure(false, string.Join(" | ", errors));
    }

    [HttpPost("RoleConfig/Reset/{roleId:int}")]
    [RequirePermission("MT_UserRoles", "MT_Settings")]
    public async Task<Result<bool>> ResetRole(int roleId, CancellationToken ct)
    {
        await roleConfigService.ResetAsync(roleId, currentUser.UserGuid, ct);
        return Result<bool>.Success(true);
    }
}
