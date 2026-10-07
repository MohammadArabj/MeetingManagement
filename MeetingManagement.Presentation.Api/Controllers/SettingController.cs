using MeetingManagement.Presentation.Api.Filters;
using MeetingManagement.Common.Security;
using MeetingManagement.Application.Contracts.Setting;
using MeetingManagement.Infrastructure.Query.Contracts.Setting;
using MeetingManagement.Presentation.Facade.Contracts.Setting;
using Microsoft.AspNetCore.Mvc;

namespace MeetingManagement.Presentation.Api.Controllers;
[ApiController]
[Route("api/[controller]")]
public class SettingController(ISettingQueryFacade settingQueryFacade, ISettingCommandFacade settingCommandFacade)
    : ControllerBase
{
    [RequirePermission(Permissions.Settings)]
    [HttpPost("Edit")]
    public void Post([FromBody] UpdateSetting command) => settingCommandFacade.UpdateSetting(command);

    [HttpGet("GetSettings")]
    public List<SettingViewModel> GetSettings() => settingQueryFacade.GetSettings();

    public SettingViewModel GetById(int id) => settingQueryFacade.GetById(id);
}
