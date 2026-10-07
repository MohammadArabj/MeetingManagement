using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Assignment;
using MeetingManagement.Application.Contracts.Resolution;
using MeetingManagement.Infrastructure.Query.Contracts.Resolution;
using MeetingManagement.Presentation.Facade.Contracts.Resolution;
using Microsoft.AspNetCore.Mvc;
using System.Drawing.Printing;

namespace MeetingManagement.Presentation.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ResolutionController(IResolutionCommandFacade commandFacade, IResolutionQueryFacade queryFacade) : ControllerBase
    {
        [HttpPost("Search")]
        public async Task<Result<List<ResolutionSearchResultDto>>> Search(ResolutionSearchRequestDto request)
            => await queryFacade.Search(request);
        [HttpPost("CreateOrEdit")]
        public async Task<Result<long>> CreateOrEdit([FromBody] CreateResolutionDto command) =>
            await commandFacade.CreateOrEdit(command);
        [HttpPost("CreateOrEditBoardMeeting")]
        public async Task<Result<long>> CreateOrEditBoardMeeting([FromBody] CreateResolutionBoardMeetingDto command) =>
            await commandFacade.CreateOrEditBoardMeeting(command);
        [HttpGet("GetList/{meetingGuid:guid}")]
        public async Task<Result<List<ResolutionJsonModel>>> List(Guid meetingGuid) =>
            await queryFacade.List(meetingGuid);

        [HttpPost("Delete/{id:long}")]
        public async Task<Result<bool>> Delete(long id) =>
            await commandFacade.Delete(id);
 
        [HttpPost("Order")]
        public async Task<Result<bool>> Order(UpdateResolutionOrderRequest orders)=> await commandFacade.Order(orders);

        [HttpGet("GetRelatedResolutions/{meetingGuid:guid}")]
        public async Task<Result<List<ComboBase>>> GetRelatedResolutions(Guid meetingGuid)
            => await queryFacade.GetRelatedResolutions(meetingGuid);
        [HttpGet("GetResolutionNumber/{meetingGuid:guid}")]
        public async Task<Result<int>> GetResolutionNumber(Guid meetingGuid) => await queryFacade.GetResolutionNumber(meetingGuid);

        /// <summary>
        /// دریافت گزارش اقدامات مصوبات یک جلسه
        /// </summary>
        /// <param name="meetingGuid">شناسه جلسه</param>
        /// <param name="resolutionId">شناسه مصوبه (اختیاری - برای فیلتر)</param>
        /// <param name="assignmentId">شناسه تخصیص (اختیاری - برای فیلتر)</param>
        [HttpGet("ActionsReport/{meetingGuid}")]
        public async Task<Result<MeetingActionsReportDto>> GetActionsReport(
            Guid meetingGuid,
            [FromQuery] int? resolutionId = null,
            [FromQuery] int? assignmentId = null)
        {
            var query = new GetActionsReportQuery
            {
                MeetingGuid = meetingGuid,
                ResolutionId = resolutionId,
                AssignmentId = assignmentId
            };
           return (Result<MeetingActionsReportDto>)await queryFacade.GetActionsReport(query);
        }
       
        /// <summary>
        /// دریافت گزارش تفصیلی مصوبات
        /// </summary>
        [HttpPost("DetailReport")]
        public async Task<Result<ResolutionReportDto>> GetDetailReport(ResolutionDetailReportRequestDto request)
            => await queryFacade.GetDetailReport(request);

    }

}
