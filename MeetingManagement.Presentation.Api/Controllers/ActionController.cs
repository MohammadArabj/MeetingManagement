using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Action;
using MeetingManagement.Application.Contracts.Assignment;
using MeetingManagement.Infrastructure.Query.Contracts.Action;
using MeetingManagement.Infrastructure.Query.Contracts.Assignment;
using MeetingManagement.Presentation.Facade.Contracts.Action;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace MeetingManagement.Presentation.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ActionController(IActionCommandFacade commandFacade,IActionQueryFacade queryFacade) : ControllerBase
    {
        [HttpGet("GetList/{id:int}")]
        public async Task<Result<List<ActionListDto>>> GetList(int id) 
            => await queryFacade.GetList(id);
        [HttpPost("CreateOrEdit")]
        public async Task<Result<bool>> CreateOrEdit([FromBody] ActionDto command) =>
            await commandFacade.CreateOrEdit(command);
        [HttpPost("Delete/{id:long}")]
        public async Task<Result<bool>> Delete(long id) =>
            await commandFacade.Delete(id);
        [HttpPost("ChangeStatus")]
        public async Task<Result<bool>> ChangeStatus(AssignmentChangeStatusDto command) => await commandFacade.ChangeStatus(command);
        [HttpPost("ReviewAction")]
        public async Task<Result<bool>> ReviewAction(ReviewActionDto reviewAction) =>
            await commandFacade.ReviewAction(reviewAction);

    }
}
