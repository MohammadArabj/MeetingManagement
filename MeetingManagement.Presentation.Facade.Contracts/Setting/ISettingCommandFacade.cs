using Epc.Core;
using MeetingManagement.Application.Contracts.Setting;

namespace MeetingManagement.Presentation.Facade.Contracts.Setting;

public interface ISettingCommandFacade : IFacadeService
{
    void UpdateSetting(UpdateSetting command);

}