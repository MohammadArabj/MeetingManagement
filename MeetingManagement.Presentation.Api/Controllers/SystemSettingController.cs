using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Setting;
using MeetingManagement.Application.Contracts.SystemSetting;
using MeetingManagement.Infrastructure.Query.Contracts.Setting;
using MeetingManagement.Infrastructure.Query.Contracts.SystemSetting;
using MeetingManagement.Presentation.Facade.Contracts.Setting;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MeetingManagement.Presentation.Api.Filters;

namespace MeetingManagement.Presentation.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
[RequirePermission("MT_Settings")] // ✅ GetPublic با AllowAnonymous مستثناست
public class SystemSettingController(
    ISystemSettingQueryFacade queryFacade,
    ISystemSettingCommandFacade commandFacade
) : ControllerBase
{
    /// <summary>
    /// دریافت همه تنظیمات (برای ادمین)
    /// </summary>
    [HttpGet("GetAll")]
    public async Task<Result<List<SettingJsonModel>>> GetAll()
        => await queryFacade.GetAll();

    /// <summary>
    /// دریافت تنظیمات عمومی (برای فرانت‌اند)
    /// </summary>
    [HttpGet("GetPublic")]
    [AllowAnonymous]
    public async Task<Result<List<SettingPublicModel>>> GetPublic()
        => await queryFacade.GetPublicSettings();

    /// <summary>
    /// دریافت یک تنظیم با شناسه
    /// </summary>
    [HttpGet("GetById/{id:int}")]
    public async Task<Result<SettingJsonModel>> GetById(int id)
        => await queryFacade.GetById(id);

    /// <summary>
    /// دریافت تنظیمات بر اساس دسته‌بندی
    /// </summary>
    [HttpGet("GetByCategory/{category:int}")]
    public async Task<Result<List<SettingJsonModel>>> GetByCategory(byte category)
        => await queryFacade.GetByCategory(category);

    /// <summary>
    /// ایجاد تنظیم جدید
    /// </summary>
    [HttpPost("Create")]
    public async Task<Result<int>> Create([FromBody] CreateSettingDto command)
        => await commandFacade.Create(command);

    /// <summary>
    /// ویرایش تنظیم
    /// </summary>
    [HttpPost("Edit")]
    public async Task<Result<bool>> Edit([FromBody] EditSettingDto command)
        => await commandFacade.Edit(command);

    /// <summary>
    /// آپدیت سریع مقدار تنظیم
    /// </summary>
    [HttpPost("UpdateValue")]
    public async Task<Result<bool>> UpdateValue([FromBody] UpdateSettingValueDto command)
        => await commandFacade.UpdateValue(command);

    /// <summary>
    /// آپدیت گروهی تنظیمات
    /// </summary>
    [HttpPost("BulkUpdate")]
    public async Task<Result<bool>> BulkUpdate([FromBody] BulkUpdateSettingsDto command)
        => await commandFacade.BulkUpdate(command);
}