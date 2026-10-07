using Epc.Company.Query;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SurveyManagement.Application.Contract.Question;
using SurveyManagement.Infrastructure.Query.Contract.Question;
using SurveyManagement.Presentation.Facade.Contract.Question;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace SurveyManagement.Presentation.Api.Controllers;

/// <summary>
/// کنترلر مدیریت سوالات نظرسنجی
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class QuestionController(
    IQuestionCommandFacade commandFacade,
    IQuestionQueryFacade queryFacade) : ControllerBase
{

    #region Commands

    /// <summary>
    /// ایجاد یا ویرایش سوال
    /// </summary>
    /// <param name="command">اطلاعات سوال</param>
    /// <returns>شناسه سوال</returns>
    [HttpPost("CreateOrEdit")]
    [ProducesResponseType(typeof(Result<Guid>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(Result<Guid>), StatusCodes.Status400BadRequest)]
    public async Task<Result<Guid>> CreateOrEdit([FromBody] CreateOrEditQuestionDto command) => await commandFacade.CreateOrEdit(command);

    /// <summary>
    /// حذف سوال
    /// </summary>
    /// <param name="guid">شناسه سوال</param>
    /// <returns>نتیجه عملیات</returns>
    [HttpDelete("{guid:guid}")]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status400BadRequest)]
    public async Task<Result<bool>> Delete(Guid guid)
    {
        var command = new DeleteQuestionDto(guid);
        var result = await commandFacade.Delete(command);
        return result;
    }

    /// <summary>
    /// مرتب‌سازی مجدد سوالات
    /// </summary>
    /// <param name="command">ترتیب جدید سوالات</param>
    /// <returns>نتیجه عملیات</returns>
    [HttpPost("Reorder")]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status400BadRequest)]
    public async Task<Result<bool>> Reorder([FromBody] ReorderQuestionsDto command)
    {
        var result = await commandFacade.Reorder(command);
        return result;
    }

    #endregion

    #region Queries

    /// <summary>
    /// دریافت لیست سوالات یک نظرسنجی
    /// </summary>
    /// <param name="surveyGuid">شناسه نظرسنجی</param>
    /// <returns>لیست سوالات</returns>
    [HttpGet("List/{surveyGuid}")]
    [ProducesResponseType(typeof(Result<List<QuestionListDto>>), StatusCodes.Status200OK)]
    public async Task<Result<List<QuestionListDto>>> GetList(Guid surveyGuid)
    {
        var request = new GetQuestionListRequest(surveyGuid);
        var result = await queryFacade.GetList(request);
        return result;
    }

    /// <summary>
    /// دریافت جزئیات سوال
    /// </summary>
    /// <param name="id">شناسه سوال</param>
    /// <returns>جزئیات سوال</returns>
    [HttpGet("GetDetail/{guid:guid}")]
    [ProducesResponseType(typeof(Result<Infrastructure.Query.Contract.Question.QuestionDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<Result<QuestionDetailDto>> GetDetail(Guid guid)
    {
        var result = await queryFacade.GetDetail(guid);
        return result;
    }

    /// <summary>
    /// دریافت سوالات برای پاسخ‌دهی
    /// </summary>
    /// <param name="surveyGuid">شناسه نظرسنجی</param>
    /// <param name="includeLogic">شامل منطق شرطی؟</param>
    /// <returns>لیست سوالات با جزئیات</returns>
    [HttpGet("ForResponse/{surveyGuid:guid}")]
    [AllowAnonymous] // برای پاسخ‌دهندگان ناشناس
    [ProducesResponseType(typeof(Result<List<QuestionDetailDto>>), StatusCodes.Status200OK)]
    public async Task<Result<List<QuestionDetailDto>>> GetQuestionsForResponse(Guid surveyGuid, [FromQuery] bool includeLogic = true)
    {
        var request = new GetQuestionsForResponseRequest(surveyGuid, includeLogic);
        var result = await queryFacade.GetQuestionsForResponse(request);
        return result;
    }

    /// <summary>
    /// دریافت آمار پاسخ‌های یک سوال
    /// </summary>
    /// <param name="guid">شناسه سوال</param>
    /// <returns>آمار سوال</returns>
    [HttpGet("{guid:guid}/Statistics")]
    [ProducesResponseType(typeof(Result<QuestionStatisticsDto>), StatusCodes.Status200OK)]
    public async Task<Result<QuestionStatisticsDto>> GetStatistics(Guid guid)
    {
        var request = new GetQuestionStatisticsRequest(guid);
        var result = await queryFacade.GetStatistics(request);
        return result;
    }

    #endregion
}
