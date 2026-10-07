using MeetingManagement.Presentation.Api.Filters;
using MeetingManagement.Common.Security;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Role;
using MeetingManagement.Infrastructure.Query.Contracts.Role;
using MeetingManagement.Presentation.Facade.Contracts.Role;
using Microsoft.AspNetCore.Mvc;

namespace MeetingManagement.Presentation.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class RoleController(IRoleCommandFacade commandFacade, IRoleQueryFacade queryFacade) : ControllerBase
    {
        [RequirePermission(Permissions.UserRoles)]
        [HttpPost("Create")]
        public async Task<Result<Guid>> Create([FromBody] CreateRoleDto command) =>
            await commandFacade.Create(command);

        [RequirePermission(Permissions.UserRoles)]

        [HttpPost("Edit")]
        public async Task<Result<bool>> Edit([FromBody] EditRoleDto command) =>
            await commandFacade.Edit(command);

        [RequirePermission(Permissions.UserRoles)]

        [HttpGet("GetList")]
        public async Task<Result<List<RoleListDto>>> List() =>
            await queryFacade.List();

        [RequirePermission(Permissions.UserRoles)]

        [HttpGet("GetForEdit/{guid:guid}")]
        public async Task<Result<RoleDetailDto>> GetDetails(Guid guid) =>
        await queryFacade.GetDetails(guid);

        [HttpGet("GetForCombo")]
        public async Task<Result<List<RoleComboDto>>> GetForCombo() =>
            await queryFacade.GetForCombo();
    }

}
