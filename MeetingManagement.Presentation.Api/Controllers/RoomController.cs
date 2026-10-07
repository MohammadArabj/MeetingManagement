using MeetingManagement.Presentation.Api.Filters;
using MeetingManagement.Common.Security;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Room;
using MeetingManagement.Infrastructure.Query.Contracts.Room;
using MeetingManagement.Presentation.Facade.Contracts.Room;
using Microsoft.AspNetCore.Mvc;

namespace MeetingManagement.Presentation.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class RoomController(IRoomQueryFacade queryFacade, IRoomCommandFacade commandFacade) : ControllerBase
    {
        [RequirePermission(Permissions.Locations)]
        [HttpPost("Create")]
        public async Task<Result<Guid>> Create([FromBody] CreateRoomDto command) =>
            await commandFacade.Create(command);

        [RequirePermission(Permissions.Locations)]

        [HttpPost("Edit")]
        public async Task<Result<bool>> Edit([FromBody] EditRoomDto command) =>
            await commandFacade.Edit(command);

        [RequirePermission(Permissions.Locations)]

        [HttpPost("Delete/{guid:guid}")]
        public async Task<Result<bool>> Delete(Guid guid) =>
            await commandFacade.Delete(guid);

        [RequirePermission(Permissions.Locations)]

        [HttpPost("Activate/{guid:guid}")]
        public async Task<Result<bool>> Activate(Guid guid) =>
            await commandFacade.Activate(guid);

        [RequirePermission(Permissions.Locations)]

        [HttpPost("Deactivate/{guid:guid}")]
        public async Task<Result<bool>> Deactivate(Guid guid) =>
            await commandFacade.Deactivate(guid);

        [RequirePermission(Permissions.Locations)]

        [HttpGet("GetList")]
        public async Task<Result<List<RoomJsonModel>>> List() =>
            await queryFacade.List();

        [RequirePermission(Permissions.Locations)]

        [HttpGet("GetForEdit/{guid:guid}")]
        public async Task<Result<RoomJsonModel>> GetDetails(Guid guid) =>
            await queryFacade.GetDetails(guid);

        [HttpGet("GetForCombo")]
        public async Task<Result<List<RoomComboModel>>> GetForCombo() =>
            await queryFacade.GetForCombo();
    }

}
