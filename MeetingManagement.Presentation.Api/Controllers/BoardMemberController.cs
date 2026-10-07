using Epc.Company.Query;
using MeetingManagement.Application.Contracts.BoardMember;
using MeetingManagement.Infrastructure.Query.Contracts.BoardMember;
using MeetingManagement.Presentation.Facade.Contracts.BoardMember;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace MeetingManagement.Presentation.Api.Controllers
{

    [Route("api/[controller]")]
    [ApiController]
    public class BoardMemberController(IBoardMemberQueryFacade queryFacade, IBoardMemberCommandFacade commandFacade) : ControllerBase
    {
        [HttpPost("Create")]
        public async Task<Result<bool>> Create([FromBody] CreateBoardMemberDto command) => await commandFacade.Create(command);

        [HttpPost("Edit")]
        public async Task<Result<bool>> Edit([FromBody] EditBoardMemberDto command) => await commandFacade.Edit(command);

        [HttpPost("Delete/{guid:guid}")]
        public async Task<Result<bool>> Delete(Guid guid) => await commandFacade.Delete(guid);

        [HttpPost("Activate/{guid:guid}")]
        public async Task<Result<bool>> Activate(Guid guid) => await commandFacade.Activate(guid);
        [HttpPost("GetByGuids")]
        public async Task<Result<List<BoardMemberDto>>> GetByGuids([FromBody]List<Guid> guids) => await queryFacade.GetByGuids(guids);

        [HttpPost("Deactivate/{guid:guid}")]
        public async Task<Result<bool>> Deactivate(Guid guid) => await commandFacade.Deactivate(guid);

        [HttpGet("GetList")]
        public async Task<Result<List<BoardMemberDto>>> GetList() => await queryFacade.GetList();
        [HttpGet("GetActiveMembers")]
        public async Task<Result<List<BoardMemberListDto>>> GetActiveMembers() => await queryFacade.GetActiveMembers();
        //[HttpGet("GetActiveList")]
        //public async Task<Result<List<BoardMemberComboModel>>> GetActiveList() => await queryFacade.GetActiveList();

        [HttpGet("GetForEdit/{guid:guid}")]
        public async Task<Result<EditBoardMemberDto>> GetForEdit(Guid guid) => await queryFacade.GetForEdit(guid);
    }
}
