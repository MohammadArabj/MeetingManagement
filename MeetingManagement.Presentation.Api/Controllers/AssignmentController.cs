using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Assignment;
using MeetingManagement.Infrastructure.Query.Contracts.Assignment;
using MeetingManagement.Presentation.Facade.Contracts.Assignment;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace MeetingManagement.Presentation.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AssignmentController(IAssignmentCommandFacade commandFacade, IAssignmentQueryFacade queryFacade) : ControllerBase
    {
        [HttpPost("CreateOrEditAssignment")]
        public async Task<Result<bool>> CreateOrEditAssignment([FromBody] AssignmentDto command) =>
            await commandFacade.CreateOrEdit(command);

        [HttpPost("Delete/{id:int}")]
        public async Task<Result<bool>> Delete(int id) =>
            await commandFacade.Delete(id);

        [HttpPost("GetBy")]
        public async Task<Result<AssignmentDto>> GetAssignment(AssignmentSearchWitPositionDto command) => await queryFacade.GetAssignment(command);

        [HttpPost("GetList")]
        public async Task<Result<List<AssignmentListDto>>> GetList([FromBody] AssignmentSearchDto search) =>
            await queryFacade.GetList(search);

        [HttpGet("GetCounts/{positionGuid:guid}")]
        public async Task<Result<AssignmentCountDto>> GetCounts(Guid positionGuid) =>
            await queryFacade.GetCounts(positionGuid);
        [HttpGet("GetOriginalAssignmentCounts/{positionGuid:guid}")]
        public async Task<Result<OriginalAssignmentCountsDto>> GetOriginalAssignmentCounts(Guid positionGuid) =>
            await queryFacade.GetOriginalAssignmentCounts(positionGuid);

        [HttpGet("GetReceivedReferralCounts/{positionGuid:guid}")]
        public async Task<Result<ReferralCountsDto>> GetReceivedReferralCounts(Guid positionGuid) =>
            await queryFacade.GetReceivedReferralCounts(positionGuid);

        [HttpGet("GetSentReferralCounts/{positionGuid:guid}")]
        public async Task<Result<ReferralCountsDto>> GetSentReferralCounts(Guid positionGuid) =>
            await queryFacade.GetSentReferralCounts(positionGuid);

        [HttpGet("GetAssignmentResolutionDetails/{id:long}")]
        public async Task<Result<AssignmentResolutionDetails>> GetAssignmentResolutionDetails(int id) =>
            await queryFacade.GetAssignmentResolutionDetails(id);
        [HttpGet("GetPendingActionCounts/{positionGuid:guid}")]
        public async Task<Result<PendingActionCountsDto>> GetPendingActionCounts(Guid positionGuid) =>
            await queryFacade.GetPendingActionCounts(positionGuid); 
        // Referral endpoints
        [HttpPost("CreateReferral")]
        public async Task<Result<bool>> CreateReferral([FromBody] AssignmentReferralDto command) =>
            await commandFacade.CreateReferral(command);

        [HttpPost("ReturnReferral")]
        public async Task<Result<bool>> ReturnReferral([FromBody] ReturnReferralDto command) =>
            await commandFacade.ReturnReferral(command);

        [HttpPost("RecallReferral")]
        public async Task<Result<bool>> RecallReferral([FromBody] RecallReferralDto command) =>
            await commandFacade.RecallReferral(command);

        [HttpGet("GetReferrals/{assignmentId:int}")]
        public async Task<Result<List<AssignmentReferralListDto>>> GetReferrals(int assignmentId) =>
            await queryFacade.GetReferrals(assignmentId);

        [HttpGet("GetAssignmentTree/{assignmentId:int}")]
        public async Task<Result<AssignmentTreeDto>> GetAssignmentTree(int assignmentId) =>
            await queryFacade.GetAssignmentTree(assignmentId);

        [HttpGet("GetMyReferrals/{userGuid:guid}")]
        public async Task<Result<List<AssignmentListDto>>> GetMyReferrals( Guid userGuid) =>
            await queryFacade.GetMyReferrals(userGuid);

        [HttpGet("GetReferralsGivenByMe/{userGuid:guid}")]
        public async Task<Result<List<AssignmentListDto>>> GetReferralsGivenByMe( Guid userGuid) =>
            await queryFacade.GetReferralsGivenByMe(userGuid);
        [HttpPost("CreateActionResult")]
        public async Task<Result<bool>> CreateActionResult(ChangeAssignmentResultDto result) =>
            await commandFacade.ChangeResult(result);
        [HttpGet("GetFollowerActorsActionCounts/{positionGuid:guid}")]
        public async Task<Result<FollowerActorsActionCountsDto>> GetFollowerActorsActionCounts(Guid positionGuid)
        =>await queryFacade.GetFollowerActorsActionCounts(positionGuid);
        [HttpGet("GetBoardActors")]
        public async Task<Result<List<AssignmentActorDto>>> GetBoardActors() =>
            await queryFacade.GetBoardActors();
    }
}