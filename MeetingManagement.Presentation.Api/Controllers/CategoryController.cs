using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Category;
using MeetingManagement.Infrastructure.Query.Contracts.Category;
using MeetingManagement.Presentation.Facade.Contracts.Category;
using Microsoft.AspNetCore.Mvc;

namespace MeetingManagement.Presentation.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CategoryController(ICategoryQueryFacade queryFacade, ICategoryCommandFacade commandFacade) : ControllerBase
    {
        [HttpPost("Create")]
        public async Task<Result<Guid>> Create([FromBody] CreateCategoryDto command) =>
            await commandFacade.Create(command);

        [HttpPost("Edit")]
        public async Task<Result<bool>> Edit([FromBody] EditCategoryDto command) =>
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
        public async Task<Result<List<CategoryJsonModel>>> List() =>
            await queryFacade.List();

        [HttpGet("GetForEdit/{guid:guid}")]
        public async Task<Result<CategoryJsonModel>> GetDetails(Guid guid) =>
            await queryFacade.GetDetails(guid);
        [HttpPost("GetForComboByCondition")]
        public async Task<Result<List<CategoryComboModel>>> GetForComboByCondition(CategoryComboSearchDto condition)
            => await queryFacade.GetForComboByCondition(condition);

        [HttpGet("GetForCombo")]
        public async Task<Result<List<CategoryComboModel>>> GetForCombo() =>
            await queryFacade.GetForCombo();

        [HttpPost("SetPermissions")]
        public async Task<Result<bool>> SetPermissions([FromBody] SetCategoryPermissionDto permissions)
            =>await commandFacade.SetPermissions(permissions);
    }

}
