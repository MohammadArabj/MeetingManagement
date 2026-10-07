using Epc.Application.Command;
using MeetingManagement.Application.Contracts.Setting;
using MeetingManagement.Presentation.Facade.Contracts.Setting;

namespace MeetingManagement.Presentation.Facade.Command;
public class SettingCommandFacade(ICommandBus commandBus) : ISettingCommandFacade
{
    public void UpdateSetting(UpdateSetting command) => commandBus.Dispatch(command);
}