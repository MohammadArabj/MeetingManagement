using MeetingManagement.Presentation.Api.Filters;
using MeetingManagement.Common.Security;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.NotificationTemplate;
using MeetingManagement.Infrastructure.Query.Contracts.NotificationTemplate;
using MeetingManagement.Presentation.Facade.Contracts.NotificationTemplate;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace MeetingManagement.Presentation.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class NotificationTemplateController(
        INotificationTemplateCommandFacade commandFacade,
        INotificationTemplateQueryFacade queryFacade) : ControllerBase
    {
        [RequirePermission(Permissions.Settings)]
        [HttpPost("Create")]
        public async Task<Result<Guid>> Create(CreateNotificationTemplateDto command)
            => await commandFacade.Create(command);

        [RequirePermission(Permissions.Settings)]

        [HttpPost("Edit")]
        public async Task<Result<bool>> Edit(EditNotificationTemplateDto command)
            => await commandFacade.Edit(command);

        [RequirePermission(Permissions.Settings)]

        [HttpPost("GetList")]
        public async Task<Result<List<NotificationTemplateDto>>> GetList()
            => await queryFacade.GetList();
    }
}
