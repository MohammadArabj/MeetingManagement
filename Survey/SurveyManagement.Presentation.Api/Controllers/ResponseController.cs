using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Epc.Company.Query;
using SurveyManagement.Presentation.Facade.Contract.Response;
using SurveyManagement.Application.Contract.Response;
using SurveyManagement.Infrastructure.Query.Contract.Response;
using SurveyManagement.Infrastructure.Query.Contract.SurveyAccess;
using SurveyManagement.Presentation.Api.Services;

namespace SurveyManagement.Presentation.Api.Controllers;

/// <summary>
/// کنترلر مدیریت پاسخ‌های نظرسنجی
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class ResponseController(
    IResponseCommandFacade commandFacade,
    IResponseQueryFacade queryFacade,
    IResponseExcelExportService excelExportService,
    IParticipantExcelExportService exportService) : ControllerBase
{

    #region Commands

    [HttpPost("Submit")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(Result<Guid>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(Result<Guid>), StatusCodes.Status400BadRequest)]
    public async Task<Result<Guid>> Submit([FromBody] SubmitResponseDto command)
    {
        var result = await commandFacade.Submit(command);
        return result;
    }

    [HttpPost("Delete/{guid:guid}")]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Delete(Guid guid)
    {
        var command = new DeleteResponseDto(guid);
        var result = await commandFacade.Delete(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    [HttpPost("AddNote")]
    [Authorize]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(Result<bool>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AddNote([FromBody] AddResponseNoteDto command)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var result = await commandFacade.AddNote(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    #endregion

    #region Queries

    [HttpPost("Search")]
    [Authorize]
    [ProducesResponseType(typeof(Result<List<ResponseListDto>>), StatusCodes.Status200OK)]
    public async Task<Result<List<ResponseListDto>>> Search([FromBody] ResponseSearchRequest request)
    {
        var result = await queryFacade.Search(request);
        return result;
    }

    [HttpGet("GetDetail/{guid}")]
    [ProducesResponseType(typeof(Result<ResponseDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<Result<ResponseDetailDto>> GetDetail(Guid guid)
    {
        var result = await queryFacade.GetDetail(guid);
        return result;
    }

    [HttpGet("Summary/{surveyGuid:guid}")]
    [Authorize]
    [ProducesResponseType(typeof(Result<ResponseSummaryDto>), StatusCodes.Status200OK)]
    public async Task<Result<ResponseSummaryDto>> GetSummary(Guid surveyGuid)
    {
        var request = new GetResponseSummaryRequest(surveyGuid);
        var result = await queryFacade.GetSummary(request);
        return result;
    }

    [HttpGet("Draft/{surveyGuid}/{userGuid}")]
    [ProducesResponseType(typeof(Result<UserDraftResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<Result<UserDraftResponseDto>> GetUserDraft(Guid surveyGuid, Guid userGuid)
    {
        var request = new GetUserDraftRequest(surveyGuid, userGuid);
        var result = await queryFacade.GetUserDraft(request);
        return result;
    }

    /// <summary>
    /// ✅ داده ماتریسی پاسخ‌ها برای پیش‌نمایش در فرانت (سوال = ستون، پاسخ‌دهنده = ردیف)
    /// </summary>
    [HttpGet("Matrix/{surveyGuid:guid}")]
    [Authorize]
    [ProducesResponseType(typeof(Result<ResponseMatrixDto>), StatusCodes.Status200OK)]
    public async Task<Result<ResponseMatrixDto>> GetMatrix(Guid surveyGuid, [FromQuery] int? status)
    {
        var request = new GetResponseMatrixRequest(surveyGuid, status);
        return await queryFacade.GetMatrix(request);
    }

    /// <summary>
    /// ✅ خروجی Excel با ستون‌های انتخابی و ترتیب دلخواه کاربر
    /// </summary>
    [HttpPost("Export")]
    [Authorize]
    [ProducesResponseType(typeof(FileResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> ExportResponses([FromBody] ExportResponsesRequestDto request)
    {
        var matrixRequest = new GetResponseMatrixRequest(request.SurveyGuid, request.Status);
        var result = await queryFacade.GetMatrix(matrixRequest);

        if (!result.IsSuccess || result.Data == null)
            return NotFound(new { message = "نظرسنجی یا داده‌ای برای خروجی یافت نشد." });

        if (result.Data.Rows.Count == 0)
            return NotFound(new { message = "هنوز پاسخی برای این نظرسنجی ثبت نشده است." });

        var bytes = excelExportService.GenerateExcel(result.Data, request.Columns);
        var fileName = SanitizeFileName($"Survey_{result.Data.SurveyTitle}_{DateTime.Now:yyyyMMdd_HHmm}.xlsx");

        return File(bytes,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            fileName);
    }

    #endregion

    [HttpGet("UserStatus/{surveyGuid:guid}/{userGuid:guid}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(Result<UserResponseStatusDto>), StatusCodes.Status200OK)]
    public async Task<Result<UserResponseStatusDto>> GetUserResponseStatus(Guid surveyGuid, Guid userGuid)
    {
        var request = new GetUserResponseStatusRequest(surveyGuid, userGuid);
        return await queryFacade.GetUserResponseStatus(request);
    }

    /// <summary>
    /// ✅ تحلیل کامل و جامع پاسخ‌های نظرسنجی (نمای کلی + سوال‌به‌سوال)
    /// </summary>
    [HttpGet("Analytics/{surveyGuid:guid}")]
    [Authorize]
    [ProducesResponseType(typeof(Result<SurveyAnalyticsDto>), StatusCodes.Status200OK)]
    public async Task<Result<SurveyAnalyticsDto>> GetAnalytics(Guid surveyGuid)
    {
        var request = new GetSurveyAnalyticsRequest(surveyGuid);
        return await queryFacade.GetAnalytics(request);
    }
    [HttpGet("Participants/{surveyGuid:guid}")]
    [Authorize]
    [ProducesResponseType(typeof(Result<ParticipantsReportDto>), StatusCodes.Status200OK)]
    public async Task<Result<ParticipantsReportDto>> GetParticipants(Guid surveyGuid) =>
    await queryFacade.GetParticipants(new GetSurveyParticipantsRequest(surveyGuid));
    // اگه Facade ندارید و مستقیم از IQueryBusAsync استفاده می‌کنید:
    // await queryBus.Dispatch<Result<ParticipantsReportDto>, GetSurveyParticipantsRequest>(new GetSurveyParticipantsRequest(surveyGuid));

    [HttpPost("ParticipantsExport")]
    [Authorize]
    public async Task<IActionResult> ExportParticipants([FromBody]ExportParticipantsRequestDto request)
    {
        var result = await queryFacade.GetParticipants(new GetSurveyParticipantsRequest(request.SurveyGuid));

        if (!result.IsSuccess || result.Data == null)
            return NotFound(new { message = "نظرسنجی یافت نشد." });

        var bytes = exportService.GenerateExcel(result.Data.SurveyTitle, result.Data.Participants);
        var fileName = SanitizeFileName($"شرکت‌کنندگان_{result.Data.SurveyTitle}_{DateTime.Now:yyyyMMdd_HHmm}.xlsx");

        return File(bytes,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            fileName);
    }

    #region Private Methods

    private static string SanitizeFileName(string name)
    {
        var invalid = Path.GetInvalidFileNameChars();
        return new string(name.Where(c => !invalid.Contains(c)).ToArray());
    }

    #endregion
}