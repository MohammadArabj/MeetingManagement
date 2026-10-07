using Epc.Company.Query;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SurveyManagement.Application.Contract.AccessControl;
using SurveyManagement.Application.Contracts.AccessControl;
using SurveyManagement.Presentation.Facade.Contract.SurveyAccess;

namespace SurveyManagement.Presentation.Api.Controllers;

/// <summary>
/// کنترلر مدیریت دسترسی‌ها و نقش‌ها
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AccessControlController(IAccessControlCommandFacade commandFacade) : ControllerBase
{

    #region Survey Access Management

    /// <summary>
    /// تنظیم دسترسی‌های نظرسنجی
    /// </summary>
    /// <param name="command">لیست دسترسی‌ها</param>
    /// <returns>نتیجه عملیات</returns>
    [HttpPost("SetSurveyAccess")]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> SetSurveyAccess([FromBody] SetSurveyAccessDto command)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var result = await commandFacade.SetSurveyAccess(command);
        
        if (!result.IsSuccess && result.Message.Contains("مجاز"))
            return Forbid();

        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    /// <summary>
    /// حذف دسترسی نظرسنجی
    /// </summary>
    /// <param name="guid">شناسه دسترسی</param>
    /// <returns>نتیجه عملیات</returns>
    [HttpDelete("RemoveSurveyAccess/{guid:guid}")]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> RemoveSurveyAccess(Guid guid)
    {
        var command = new RemoveSurveyAccessDto(guid);
        var result = await commandFacade.RemoveSurveyAccess(command);
        
        if (!result.IsSuccess && result.Message.Contains("مجاز"))
            return Forbid();

        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    #endregion

    #region Role Assignment

    /// <summary>
    /// تخصیص نقش به کاربر
    /// </summary>
    /// <param name="command">اطلاعات تخصیص نقش</param>
    /// <returns>نتیجه عملیات</returns>
    [HttpPost("AssignRoleToUser")]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AssignRoleToUser([FromBody] AssignRoleToUserDto command)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var result = await commandFacade.AssignRoleToUser(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    /// <summary>
    /// حذف نقش از کاربر
    /// </summary>
    /// <param name="guid">شناسه تخصیص نقش</param>
    /// <returns>نتیجه عملیات</returns>
    [HttpDelete("RemoveRoleFromUser/{guid:guid}")]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RemoveRoleFromUser(Guid guid)
    {
        var command = new RemoveRoleFromUserDto(guid);
        var result = await commandFacade.RemoveRoleFromUser(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    #endregion

    #region Role Management

    /// <summary>
    /// ایجاد نقش جدید
    /// </summary>
    /// <param name="command">اطلاعات نقش</param>
    /// <returns>شناسه نقش</returns>
    [HttpPost("CreateRole")]
    [ProducesResponseType(typeof(Result<int>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(Result<int>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateRole([FromBody] CreateRoleDto command)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var result = await commandFacade.CreateRole(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    /// <summary>
    /// ویرایش نقش
    /// </summary>
    /// <param name="command">اطلاعات نقش</param>
    /// <returns>نتیجه عملیات</returns>
    [HttpPut("EditRole")]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> EditRole([FromBody] EditRoleDto command)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var result = await commandFacade.EditRole(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    /// <summary>
    /// حذف نقش
    /// </summary>
    /// <param name="id">شناسه نقش</param>
    /// <returns>نتیجه عملیات</returns>
    [HttpDelete("DeleteRole/{id:int}")]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> DeleteRole(int id)
    {
        var command = new DeleteRoleDto(id);
        var result = await commandFacade.DeleteRole(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    #endregion
}
