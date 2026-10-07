using Epc.Application.Command;
using Epc.Company.Query;
using System.Threading.Tasks;
using System;
using MeetingManagement.Application.Contracts.NotificationTemplate;
using MeetingManagement.Presentation.Facade.Contracts.NotificationTemplate;

namespace MeetingManagement.Presentation.Facade.Command;
public class NotificationTemplateCommandFacade(IResponsiveCommandBusAsync bus) : INotificationTemplateCommandFacade
{
    public async Task<Result<Guid>> Create(CreateNotificationTemplateDto command)
        => await bus.Dispatch<CreateNotificationTemplateDto, Result<Guid>>(command);

    public async Task<Result<bool>> Edit(EditNotificationTemplateDto command)
        => await bus.Dispatch<EditNotificationTemplateDto, Result<bool>>(command);
}