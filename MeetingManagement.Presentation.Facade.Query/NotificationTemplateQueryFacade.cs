using Epc.Application.Command;
using Epc.Company.Query;
using MeetingManagement.Presentation.Facade.Contracts.NotificationTemplate;
using System.Threading.Tasks;
using System;
using MeetingManagement.Application.Contracts.NotificationTemplate;

namespace MeetingManagement.Presentation.Facade.Query;

public class NotificationTemplateCommandFacade(IResponsiveCommandBusAsync bus) : INotificationTemplateCommandFacade
{
    public async Task<Result<Guid>> Create(CreateNotificationTemplateDto command)
        => await bus.Dispatch<CreateNotificationTemplateDto, Result<Guid>>(command);

    public async Task<Result<bool>> Edit(EditNotificationTemplateDto command)
        => await bus.Dispatch<EditNotificationTemplateDto, Result<bool>>(command);
}