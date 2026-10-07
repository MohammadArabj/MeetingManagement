using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Member;
using MeetingManagement.Infrastructure.Query.Contracts.Member;
using MeetingManagement.Presentation.Facade.Contracts.Member;
using Microsoft.AspNetCore.Mvc;

namespace MeetingManagement.Presentation.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MeetingMemberController(IMemberCommandFacade commandFacade, IMemberQueryFacade queryFacade) : ControllerBase
    {
        [HttpPost("CreateOrEdit")]
        public async Task<Result<long>> CreateOrEdit([FromBody] MeetingMemberDto command) =>
            await commandFacade.CreateOrEdit(command);
        [HttpPost("CreateMember")]
        public async Task<Result<bool>> CreateMember([FromBody] CreateMemberDto command) =>
            await commandFacade.CreateMember(command);
        [HttpPost("GetList")]
        public async Task<Result<List<MeetingMemberListDto>>> List(MemberSearchDto condition) =>
            await queryFacade.List(condition);

        [HttpPost("GetBy")]
        public async Task<Result<MeetingMemberSignatureDetailsDto>> GetDetails(MeetingMemberSearchDto condition) =>
            await queryFacade.GetDetails(condition);

        [HttpPost("Delete/{id:long}")]
        public async Task<Result<bool>> Delete(long id) =>
            await commandFacade.Delete(id);
        [HttpPost("SetComment")]
        public async Task<Result<bool>> SetComment(MeetingMemberCommentDto comment) =>
            await commandFacade.SetComment(comment);
        [HttpPost("SetSubstitute")]
        public async Task<Result<bool>> SetSubstitute(SetSubstituteDto command) =>
            await commandFacade.SetSubstitute(command);

        [HttpPost("Attendance")]
        public async Task<Result<bool>> Attendance(AttendanceMemberDto request)
            => await commandFacade.Attendance(request);
          [HttpPost("SetGroupAttendance")]
        public async Task<Result<bool>> SetGroupAttendance(AttendanceGroupDto request)
            => await commandFacade.SetGroupAttendance(request);
    }

}
