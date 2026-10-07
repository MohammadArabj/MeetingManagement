using System.Collections.Generic;
using System.Threading.Tasks;
using Epc.Company.Query;
using MeetingManagement.Infrastructure.Query.Contracts.NotificationTemplate;

namespace MeetingManagement.Presentation.Facade.Contracts.NotificationTemplate;

public interface INotificationTemplateQueryFacade
{
    Task<Result<List<NotificationTemplateDto>>> GetList();
}