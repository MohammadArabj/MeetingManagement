using Epc.Company.Query;
using MeetingManagement.Application.Contracts.NotificationSetting;
using MeetingManagement.Infrastructure.Query.Contracts.NotificationSetting;
using MeetingManagement.Presentation.Facade.Contracts.NotificationSetting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace MeetingManagement.Presentation.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class NotificationSettingController(
        INotificationSettingCommandFacade commandFacade,
        INotificationSettingQueryFacade queryFacade) : ControllerBase
    {
        [HttpPost("Create")]
        public async Task<Result<Guid>> Create(CreateNotificationSettingDto command)
            => await commandFacade.Create(command);

        [HttpPost("Edit")]
        public async Task<Result<bool>> Edit(EditNotificationSettingDto command)
            => await commandFacade.Edit(command);

        [HttpPost("GetList")]
        public async Task<Result<List<NotificationSettingDto>>> GetList()
            => await queryFacade.GetList();
    }
}
