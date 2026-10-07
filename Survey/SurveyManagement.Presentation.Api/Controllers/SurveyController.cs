using Epc.Company.Query;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SurveyManagement.Application.Contract.Survey;
using SurveyManagement.Infrastructure.Query.Contract.Survey;
using SurveyManagement.Presentation.Facade.Contract.Survey;
using System.Security.Claims;

namespace SurveyManagement.Presentation.Api.Controllers;

/// <summary>
/// کنترلر مدیریت نظرسنجی‌ها
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SurveyController(
    ISurveyCommandFacade commandFacade,
    ISurveyQueryFacade queryFacade) : ControllerBase
{

    #region Commands

    /// <summary>
    /// ایجاد یا ویرایش نظرسنجی
    /// </summary>
    /// <param name="command">اطلاعات نظرسنجی</param>
    /// <returns>شناسه نظرسنجی</returns>
    [HttpPost("CreateOrEdit")]
    [ProducesResponseType(typeof(Result<Guid>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(Result<Guid>), StatusCodes.Status400BadRequest)]
    public async Task<Result<Guid>> CreateOrEdit([FromBody] CreateOrEditSurveyDto command)
    {
        var result = await commandFacade.CreateOrEdit(command);
        return result;
    }

    /// <summary>
    /// ایجاد یا ویرایش نظرسنجی همراه با سوالات (Wizard)
    /// </summary>
    /// <param name="command">اطلاعات نظرسنجی و سوالات</param>
    /// <returns>شناسه نظرسنجی و سوالات</returns>
    [HttpPost("CreateOrEditWithQuestions")]
    [ProducesResponseType(typeof(Result<CreateSurveyWithQuestionsResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(Result<CreateSurveyWithQuestionsResponse>), StatusCodes.Status400BadRequest)]
    public async Task<Result<CreateSurveyWithQuestionsResponse>> CreateOrEditWithQuestions([FromBody] CreateSurveyWithQuestionsDto command)
    {

        var result = await commandFacade.CreateOrEditWithQuestions(command);
        return result;
    }
    /// <summary>
    /// دریافت جزئیات نظرسنجی همراه با سوالات (برای Edit Mode در Wizard)
    /// </summary>
    /// <param name="guid">شناسه نظرسنجی</param>
    /// <returns>اطلاعات نظرسنجی و سوالات</returns>
    [HttpGet("GetDetailWithQuestions/{guid:guid}")]
    [ProducesResponseType(typeof(Result<GetSurveyWithQuestionsResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetDetailWithQuestions(Guid guid)
    {
        var request = new GetSurveyWithQuestionsRequest(guid);
        var result = await queryFacade.GetDetailWithQuestions(request);
        return result.IsSuccess ? Ok(result) : NotFound(result);
    }
    /// <summary>
    /// حذف نظرسنجی
    /// </summary>
    /// <param name="guid">شناسه نظرسنجی</param>
    /// <returns>نتیجه عملیات</returns>
    [HttpDelete("{guid:guid}")]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Delete(Guid guid)
    {
        var command = new DeleteSurveyDto(guid);
        var result = await commandFacade.Delete(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    /// <summary>
    /// انتشار نظرسنجی
    /// </summary>
    /// <param name="guid">شناسه نظرسنجی</param>
    /// <returns>نتیجه عملیات</returns>
    [HttpPost("Publish/{guid:guid}")]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status400BadRequest)]
    public async Task<Result<bool>> Publish(Guid guid)
    {
        var command = new PublishSurveyDto(guid);
        var result = await commandFacade.Publish(command);
        return result;
    }

    /// <summary>
    /// فعال‌سازی نظرسنجی
    /// </summary>
    /// <param name="guid">شناسه نظرسنجی</param>
    /// <returns>نتیجه عملیات</returns>
    [HttpPost("Activate/{guid:guid}")]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status400BadRequest)]
    public async Task<Result<bool>> Activate(Guid guid)
    {
        var command = new ActivateSurveyDto(guid);
        var result = await commandFacade.Activate(command);
        return result;
    }

    /// <summary>
    /// بستن نظرسنجی
    /// </summary>
    /// <param name="guid">شناسه نظرسنجی</param>
    /// <returns>نتیجه عملیات</returns>
    [HttpPost("Close/{guid:guid}")]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status400BadRequest)]
    public async Task<Result<bool>> Close(Guid guid)
    {
        var command = new CloseSurveyDto(guid);
        var result = await commandFacade.Close(command);
        return result;
    }

    /// <summary>
    /// متوقف کردن موقت نظرسنجی
    /// </summary>
    /// <param name="guid">شناسه نظرسنجی</param>
    /// <returns>نتیجه عملیات</returns>
    [HttpPost("Pause/{guid:guid}")]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status400BadRequest)]
    public async Task<Result<bool>> Pause(Guid guid)
    {
        var command = new PauseSurveyDto(guid);
        var result = await commandFacade.Pause(command);
        return result;
    }

    /// <summary>
    /// آرشیو کردن نظرسنجی
    /// </summary>
    /// <param name="id">شناسه نظرسنجی</param>
    /// <returns>نتیجه عملیات</returns>
    [HttpPost("Archive/{guid:guid}")]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status400BadRequest)]
    public async Task<Result<bool>> Archive(Guid guid)
    {
        var command = new ArchiveSurveyDto(guid);
        var result = await commandFacade.Archive(command);
        return result;
    }

    #endregion

    #region Queries

    /// <summary>
    /// جستجوی نظرسنجی‌ها با فیلتر
    /// </summary>
    /// <param name="request">پارامترهای جستجو</param>
    /// <returns>لیست نظرسنجی‌ها</returns>
    [HttpPost("Search")]
    [ProducesResponseType(typeof(Result<List<SurveyListDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Search([FromBody] SurveySearchRequest request)
    {
        var result = await queryFacade.Search(request);
        return Ok(result);
    }

    /// <summary>
    /// دریافت جزئیات نظرسنجی
    /// </summary>
    /// <param name="guid">شناسه نظرسنجی</param>
    /// <returns>جزئیات نظرسنجی</returns>
    [HttpGet("GetDetail/{guid:guid}")]
    [ProducesResponseType(typeof(Result<SurveyDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<Result<SurveyDetailDto>> GetDetail(Guid guid)
    {
        var result = await queryFacade.GetDetail(guid);
        return result;
    }

    /// <summary>
    /// دریافت لیست نظرسنجی‌ها برای ComboBox
    /// </summary>
    /// <returns>لیست ساده نظرسنجی‌ها</returns>
    [HttpGet("Combo")]
    [ProducesResponseType(typeof(Result<List<SurveyComboDto>>), StatusCodes.Status200OK)]
    public async Task<Result<List<SurveyComboDto>>> GetComboList()
    {
        var result = await queryFacade.GetComboList();
        return result;
    }

    /// <summary>
    /// دریافت آمار نظرسنجی
    /// </summary>
    /// <param name="guid">شناسه نظرسنجی</param>
    /// <returns>آمار نظرسنجی</returns>
    [HttpGet("Statistics/{guid:guid}")]
    [ProducesResponseType(typeof(Result<SurveyStatisticsDto>), StatusCodes.Status200OK)]
    public async Task<Result<SurveyStatisticsDto>> GetStatistics(Guid guid)
    {
        var request = new GetSurveyStatisticsRequest(guid);
        var result = await queryFacade.GetStatistics(request);
        return result;
    }

    /// <summary>
    /// دریافت تاریخچه تغییرات نظرسنجی
    /// </summary>
    /// <param name="guid">شناسه نظرسنجی</param>
    /// <returns>لیست تغییرات</returns>
    [HttpGet("ChangeLogs/{guid:guid}")]
    [ProducesResponseType(typeof(Result<List<SurveyChangeLogDto>>), StatusCodes.Status200OK)]
    public async Task<Result<List<SurveyChangeLogDto>>> GetChangeLogs(Guid guid)
    {
        var request = new GetSurveyChangeLogsRequest(guid);
        var result = await queryFacade.GetChangeLogs(request);
        return result;
    }

    #endregion

    // اضافه کردن به SurveyController.cs

    #region Public Survey Access

    /// <summary>
    /// دریافت اطلاعات نظرسنجی برای پاسخ‌دهی عمومی (بدون نیاز به لاگین)
    /// </summary>
    /// <param name="guid">شناسه نظرسنجی</param>
    /// <returns>اطلاعات نظرسنجی و سوالات</returns>
    [HttpGet("Public/{guid:guid}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(Result<PublicSurveyDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<Result<PublicSurveyDto>> GetPublicSurvey(Guid guid)
    {
        var request = new GetPublicSurveyRequest(guid);
        var result = await queryFacade.GetPublicSurvey(request);

        return result;
    }

    /// <summary>
    /// دریافت لینک عمومی نظرسنجی
    /// </summary>
    /// <param name="guid">شناسه نظرسنجی</param>
    /// <returns>لینک و QR Code</returns>
    [HttpGet("GetPublicLink/{guid:guid}")]
    [Authorize]
    [ProducesResponseType(typeof(Result<SurveyPublicLinkDto>), StatusCodes.Status200OK)]
    public async Task<Result<SurveyPublicLinkDto>> GetPublicLink(Guid guid)
    {
        var request = new GetSurveyPublicLinkRequest(guid);
        var result = await queryFacade.GetPublicLink(request);
        return result;
    }

    #endregion
    /// <summary>
    /// دریافت نظرسنجی‌های اختصاص‌یافته به کاربر جاری
    /// </summary>
    /// <param name="filter">فیلتر وضعیت (اختیاری): 0=همه, 1=شروع‌نشده, 2=در‌حال‌انجام, 3=تکمیل‌شده, 4=منقضی</param>
    /// <returns>لیست نظرسنجی‌ها با وضعیت پاسخ</returns>
    [HttpGet("MySurveys")]
    [Authorize]
    public async Task<Result<List<MySurveyListDto>>> GetMySurveys(
        [FromQuery] int? filter = null,
        [FromQuery] Guid? userGuid = null)   // ← اضافه شد برای server-to-server call
    {
        // اگر userGuid از بیرون آمد (client credentials) استفاده کن
        // وگرنه از claim خود کاربر بخوان
        var targetUserGuid = userGuid
            ?? Guid.Parse(User.FindFirst("sub")?.Value
                ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? Guid.Empty.ToString());

        var request = new GetMySurveysRequest(
            UserGuid: targetUserGuid,
            Filter: filter.HasValue ? (MySurveyFilter)filter.Value : null
        );

        return await queryFacade.GetMySurveys(request);
    }
    [HttpGet("GetActiveSurveys")]
    [Authorize]
    public async Task<Result<List<MySurveyListDto>>> GetActiveSurveys(
        [FromQuery] Guid? userGuid = null)   
    {

        return await queryFacade.GetActiveSurveys(userGuid);
    }

}
