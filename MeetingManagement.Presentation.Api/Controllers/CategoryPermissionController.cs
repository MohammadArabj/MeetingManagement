using Epc.Company.Query;
using MeetingManagement.Application.Contracts.CategoryPermission;
using MeetingManagement.Presentation.Facade.Contracts;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace MeetingManagement.Presentation.Api.Controllers
{


    [Route("api/[controller]")]
    [ApiController]
    public class CategoryPermissionController(
        ICategoryPermissionQueryFacade queryFacade,
        ICategoryPermissionCommandFacade commandFacade) : ControllerBase
    {
        [HttpGet("GetByCategory/{categoryId:int}")]
        public async Task<Result<List<CategoryPermissionDto>>> GetByCategory(int categoryId) =>
            await queryFacade.GetByCategoryAsync(categoryId);
        [HttpGet("GetByCategory/{categoryGuid:guid}")]
        public async Task<Result<List<CategoryPermissionDto>>> GetByCategory(Guid categoryGuid) =>
            await queryFacade.GetByCategoryAsync(categoryGuid);
        [HttpGet("CheckAccess/{categoryId:int}/{positionGuid:guid}")]
        public async Task<Result<bool>> CheckAccess(int categoryId, Guid positionGuid) =>
            await queryFacade.CheckAccessAsync(categoryId, positionGuid);

        [HttpPost("SetPermissions")]
        public async Task<Result<bool>> SetPermissions([FromBody] SetCategoryPermissionDto command) =>
            await commandFacade.SetPermissionsAsync(command);
    }
}
