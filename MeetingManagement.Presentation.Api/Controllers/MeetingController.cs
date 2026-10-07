using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Agenda;
using MeetingManagement.Application.Contracts.Meeting;
using MeetingManagement.Infrastructure.Query.Contracts.Meeting;
using MeetingManagement.Presentation.Facade.Contracts.Meeting;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MeetingManagement.Presentation.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MeetingController(IMeetingQueryFacade queryFacade, IMeetingCommandFacade commandFacade) : ControllerBase
    {
        [HttpPost("Create")]
        public async Task<Result<CreateMeetingResultDto>> Create([FromBody] CreateMeetingDto command) => await commandFacade.Create(command);

        [HttpPost("GetList")]
        public async Task<Result<List<MeetingJsonModel>>> List(MeetingListSearchDto search) => await queryFacade.List(search);

        [HttpGet("GetListByCategoryGuid/{categoryGuid:guid}")]
        public async Task<Result<List<ComboBase>>> GetListByCategoryGuid(Guid categoryGuid) => await queryFacade.GetListByCategoryGuid(categoryGuid);
        [HttpPost("Edit")]
        public async Task<Result<bool>> Edit([FromBody] EditMeetingDto command) => await commandFacade.Edit(command);

        [HttpPost("UpdateDescription")]
        public async Task<Result<bool>> UpdateDescription([FromBody] MeetingDescriptionEditModel command) => await commandFacade.UpdateDescription(command);

        [HttpPost("Delete/{guid:guid}")]
        public async Task<Result<bool>> Delete(Guid guid) => await commandFacade.Delete(guid);

        [HttpPost("GetBy")]
        public async Task<Result<MeetingJsonModel>> GetDetails(MeetingSearchDto condition) => await queryFacade.GetDetails(condition);

        [HttpGet("GetForEdit/{guid:guid}")]
        public async Task<Result<EditMeetingDto>> GetForEdit(Guid guid) => await queryFacade.GetForEdit(guid);

        [HttpGet("GetForCombo")]
        public async Task<Result<List<MeetingComboModel>>> GetForCombo() => await queryFacade.GetForCombo();
        [HttpGet("GetAgendas/{meetingGuid:guid}")]
        public async Task<Result<List<AgendaDto>>> GetAgendas(Guid meetingGuid) => await queryFacade.GetAgendas(meetingGuid);
        [HttpPost("ChangeStatus")]
        public async Task<Result<bool>> ChangeStatus([FromBody] ChangeStatusModel command) =>
            await commandFacade.ChangeStatus(command);
        [HttpPost("EditAgenda")]
        public async Task<Result<bool>> EditAgenda([FromForm] CreateOrEditAgendaModel command) => await commandFacade.EditAgenda(command);
        [HttpPost("DeleteAgenda/{guid:guid}")]
        public async Task<Result<bool>> DeleteAgenda(Guid guid) => await commandFacade.DeleteAgenda(guid);
        [HttpGet("GetGuests/{meetingGuid:guid}")]
        public async Task<Result<List<GuestComboDto>>> GetGuests(Guid meetingGuid) => await queryFacade.GetGuests(meetingGuid);
        [HttpPost("UploadFiles")]
        public async Task<Result<bool>> UploadFiles([FromBody] MeetingAttachmentDto attachment) => await commandFacade.UploadFiles(attachment);
        [HttpPost("GetMeetingCounts")]
        public async Task<Result<MeetingCountDto>> GetMeetingCounts(MeetingCountRequestDto request) => await queryFacade.GetMeetingCounts(request);
        [HttpPost("CheckConflicts")]
        public async Task<Result<MeetingConflictResultDto>> CheckConflicts([FromBody] MeetingConflictCheckDto condition)
            => await queryFacade.CheckConflicts(condition);
        [HttpPost("UpdateRider")]
        public async Task<Result<UpdateRiderResultDto>> UpdateRider([FromForm] MeetingRiderDto command) => await commandFacade.UpdateRider(command);
        [HttpGet("DeleteRiderFile/{meetingGuid:guid}")]
        public async Task<Result<bool>> DeleteRiderFile(Guid meetingGuid) => await commandFacade.DeleteRiderFile(meetingGuid);
        [HttpGet("GetTodayTommorrowMeetings/{userGuid:guid}")]
        public async Task<Result<List<TodayMeetingDto>>> GetTodayTommorrowMeetings(Guid userGuid) =>
            await queryFacade.GetTodayTommorrowMeetings(userGuid);
        [HttpGet("CheckMeeting/{meetingGuid:guid}")]

        public async Task<Result<CheckMeetingDto>> CheckMeeting(Guid meetingGuid)
        => await queryFacade.CheckMeeting(meetingGuid);
        [HttpPost("GetCalendarMeetings")]
        public async Task<Result<List<MeetingCalendarDto>>> GetCalendarMeetings(MeetingCalendarSearchDto search)
            => await queryFacade.GetCalendarMeetings(search);

        [HttpPost("Search")]
        public async Task<Result<List<MeetingJsonModel>>> Search(MeetingSearchRequestDto request)
            => await queryFacade.Search(request);

        [HttpGet("CheckSign/{meetingGuid:guid}")]
        public async Task<Result<bool>> CheckSign(Guid meetingGuid)
            => await queryFacade.CheckSign(meetingGuid);
        [HttpPost("GetMeetingStatistic")]
        public async Task<Result<List<MeetingStatisticResultDto>>> GetMeetingStatistic(
            MeetingStatisticRequestDto request)
            => await queryFacade.GetMeetingStatistic(request);
        [HttpPost("CheckMeetingNumber")]
        public async Task<Result<CheckMeetingNumberResultDto>> CheckMeetingNumber([FromBody] CheckMeetingNumberDto condition)
            => await queryFacade.CheckMeetingNumber(condition);
        [HttpGet("GetFutureMeetings")]
        [Authorize]
        public async Task<Result<List<MeetingFutureDto>>> GetFutureMeetings(
        [FromQuery] Guid? userGuid = null,
        [FromQuery] Guid? positionGuid = null)
        {

            return await queryFacade.GetFutureMeetings(userGuid, positionGuid);
        }

        [HttpPost("GetSuggestedSlots")]
        public async Task<Result<List<SuggestedSlotDto>>> GetSuggestedSlots(
    [FromBody] SuggestedSlotsRequestDto request)
    => await queryFacade.GetSuggestedSlots(request);
    }
}
