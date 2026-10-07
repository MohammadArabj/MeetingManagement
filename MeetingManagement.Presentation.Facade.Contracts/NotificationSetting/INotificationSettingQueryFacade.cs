using System.Collections.Generic;
using System.Threading.Tasks;
using Epc.Company.Query;
using Epc.Core;
using MeetingManagement.Infrastructure.Query.Contracts.NotificationSetting;

namespace MeetingManagement.Presentation.Facade.Contracts.NotificationSetting;

public interface INotificationSettingQueryFacade:IFacadeService
{
    Task<Result<List<NotificationSettingDto>>> GetList();
}