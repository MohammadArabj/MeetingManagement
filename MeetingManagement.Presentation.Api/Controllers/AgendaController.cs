using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Agenda;
using MeetingManagement.Application.Contracts.Resolution;
using MeetingManagement.Infrastructure.Query.Contracts.Agenda;
using MeetingManagement.Presentation.Facade.Contracts.Agenda;
using Microsoft.AspNetCore.Mvc;

namespace MeetingManagement.Presentation.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AgendaController(IAgendaCommandFacade commandFacade, IAgendaQueryFacade queryFacade) : ControllerBase
    {
        [HttpPost("CreateOrEdit")]
        public async Task<Result<long>> CreateOrEdit([FromBody] AgendaDto command) =>
            await commandFacade.CreateOrEdit(command);

        [HttpGet("GetList/{meetingGuid:guid}")]
        public async Task<Result<List<AgendaListDto>>> List(Guid meetingGuid) =>
            await queryFacade.List(meetingGuid);

        [HttpPost("Delete/{id:long}")]
        public async Task<Result<bool>> Delete(long id) =>
            await commandFacade.Delete(id);

        [HttpPost("DeleteFile/{id:long}")]
        public async Task<Result<bool>> DeleteFile(long id) => await commandFacade.DeleteFile(id);
        [HttpPost("Order")]
        public async Task<Result<bool>> Order(UpdateAgendaOrderRequest orders) => await commandFacade.Order(orders);
    }

}
