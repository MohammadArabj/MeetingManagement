using Epc.Company.Query;
using System.Threading.Tasks;
using System;
using Epc.Core;
using MeetingManagement.Application.Contracts.NotificationTemplate;

namespace MeetingManagement.Presentation.Facade.Contracts.NotificationTemplate;

public interface INotificationTemplateCommandFacade:IFacadeService
{
    Task<Result<Guid>> Create(CreateNotificationTemplateDto command);

    Task<Result<bool>> Edit(EditNotificationTemplateDto command);
}