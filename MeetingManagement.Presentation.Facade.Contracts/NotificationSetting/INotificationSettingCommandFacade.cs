using System;
using System.Threading.Tasks;
using Epc.Company.Query;
using Epc.Core;
using MeetingManagement.Application.Contracts.NotificationSetting;

namespace MeetingManagement.Presentation.Facade.Contracts.NotificationSetting;

public interface INotificationSettingCommandFacade: IFacadeService
{
    Task<Result<Guid>> Create(CreateNotificationSettingDto command);
    Task<Result<bool>> Edit(EditNotificationSettingDto command);
}