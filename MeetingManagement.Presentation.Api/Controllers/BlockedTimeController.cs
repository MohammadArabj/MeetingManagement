using MeetingManagement.Domain.Shared.Access;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.BlockedTime;
using MeetingManagement.Infrastructure.Query.Contracts.BlockedTime;
using MeetingManagement.Infrastructure.Query.Contracts.UserBlockedTime;
using MeetingManagement.Presentation.Facade.Contracts.BlockedTime;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MeetingManagement.Presentation.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public class BlockedTimeController(
    IBlockedTimeCommandFacade commandFacade,
    IBlockedTimeQueryFacade queryFacade,
    IActingIdentityResolver identityResolver) : ControllerBase
{
    /// <summary>
    /// دریافت لیست زمان‌های عدم حضور
    /// </summary>
    [HttpGet("List/{userGuid:guid}")]
    public async Task<Result<List<BlockedTimeJsonModel>>> List(Guid userGuid) =>
        // زمان‌های عدم حضور (با شرح) شخصی هستند؛ هر کاربر فقط فهرست خودش را می‌بیند
        await queryFacade.GetList((await identityResolver.ResolveAsync(HttpContext.RequestAborted)).UserGuid);

    /// <summary>
    /// دریافت زمان‌های عدم حضور برای تقویم
    /// </summary>
    [HttpGet("Calendar/{userGuid:guid}")]
    public async Task<Result<List<BlockedTimeJsonModel>>> Calendar(
        Guid userGuid,
        [FromQuery] string? fromDate,
        [FromQuery] string? toDate) =>
        await queryFacade.GetForCalendar(new BlockedTimeCalendarSearchDto
        {
            UserGuid = (await identityResolver.ResolveAsync(HttpContext.RequestAborted)).UserGuid,
            FromDate = fromDate,
            ToDate = toDate
        });

    /// <summary>
    /// ایجاد زمان عدم حضور
    /// </summary>
    [HttpPost("Create")]
    public async Task<Result<BlockedTimeJsonModel>> Create([FromBody] CreateBlockedTimeDto command) =>
        await commandFacade.Create(command);

    /// <summary>
    /// ویرایش زمان عدم حضور
    /// </summary>
    [HttpPost("Update")]
    public async Task<Result<BlockedTimeJsonModel>> Update([FromBody] UpdateBlockedTimeDto command) =>
        await commandFacade.Update(command);

    /// <summary>
    /// حذف زمان عدم حضور
    /// </summary>
    [HttpDelete("Delete/{guid:guid}")]
    public async Task<Result<bool>> Delete(Guid guid) =>
        await commandFacade.Delete(guid);

    /// <summary>
    /// بررسی در دسترس بودن یک کاربر
    /// </summary>
    [HttpPost("CheckAvailability")]
    public async Task<Result<AvailabilityResultModel>> CheckAvailability([FromBody] CheckAvailabilityDto condition) =>
        await queryFacade.CheckAvailability(condition);

    /// <summary>
    /// بررسی در دسترس بودن چند کاربر
    /// </summary>
    [HttpPost("CheckMultipleAvailability")]
    public async Task<Result<MultipleAvailabilityResultModel>> CheckMultipleAvailability(
        [FromBody] CheckMultipleAvailabilityDto condition) =>
        await queryFacade.CheckMultipleAvailability(condition);
}