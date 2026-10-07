using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Status;
using MeetingManagement.Infrastructure.Query.Contracts.Status;
using MeetingManagement.Presentation.Facade.Contracts.Status;
using Microsoft.AspNetCore.Mvc;

namespace MeetingManagement.Presentation.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class StatusController(IStatusCommandFacade commandFacade, IStatusQueryFacade queryFacade)
        : ControllerBase
    {
        [HttpPost("Create")]
        public async Task<Result<Guid>> Create([FromBody] CreateStatusDto command) =>
            await commandFacade.Create(command);

        [HttpPost("Edit")]
        public async Task<Result<bool>> Edit([FromBody] EditStatusDto command) =>
            await commandFacade.Edit(command);

        [HttpGet("GetList")]
        public async Task<Result<List<StatusListDto>>> List() =>
            await queryFacade.List();

        [HttpGet("GetForEdit/{guid:guid}")]
        public async Task<Result<StatusDetailDto>> GetDetails(Guid guid) =>
            await queryFacade.GetDetails(guid);

        [HttpGet("GetForCombo")]
        public async Task<Result<List<StatusComboDto>>> GetForCombo() =>
            await queryFacade.GetForCombo();
    }

}
