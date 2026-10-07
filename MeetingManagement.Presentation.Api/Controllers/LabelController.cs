using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Label;
using MeetingManagement.Infrastructure.Query.Contracts.Label;
using MeetingManagement.Presentation.Facade.Contracts.Label;
using Microsoft.AspNetCore.Mvc;

namespace MeetingManagement.Presentation.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class LabelController(ILabelCommandFacade commandFacade, ILabelQueryFacade queryFacade) : ControllerBase
    {
        [HttpPost("Create")]
        public async Task<Result<Guid>> Create([FromBody] CreateLabelDto command) =>
            await commandFacade.Create(command);

        [HttpPost("Edit")]
        public async Task<Result<bool>> Edit([FromBody] EditLabelDto command) =>
            await commandFacade.Edit(command);

        [HttpPost("Delete/{guid:guid}")]
        public async Task<Result<bool>> Delete(Guid guid) =>
            await commandFacade.Delete(guid);

        [HttpPost("Activate/{guid:guid}")]
        public async Task<Result<bool>> Activate(Guid guid) =>
            await commandFacade.Activate(guid);

        [HttpPost("Deactivate/{guid:guid}")]
        public async Task<Result<bool>> Deactivate(Guid guid) =>
            await commandFacade.Deactivate(guid);

        [HttpGet("GetList")]
        public async Task<Result<List<LabelListDto>>> List() =>
            await queryFacade.List();

        [HttpGet("GetForEdit/{guid:guid}")]
        public async Task<Result<LabelDetailDto>> GetDetails(Guid guid) =>
            await queryFacade.GetDetails(guid);

        [HttpGet("GetForCombo")]
        public async Task<Result<List<LabelComboDto>>> GetForCombo() =>
            await queryFacade.GetForCombo();
    }

}
