using Epc.Application.Command;
using Epc.Company.Query;
using Epc.Domain;
using MeetingManagement.Application.Contracts.NotificationTemplate;
using MeetingManagement.Domain.NotificationTemplateAgg;
using System.IO;

namespace MeetingManagement.Application;
//public class CreateNotificationTemplateHandler(INotificationTemplateRepository repo)
//    : ICommandHandlerAsync<CreateNotificationTemplateDto, Result<bool>>,
//        ICommandHandlerAsync<EditNotificationTemplateDto, Result<bool>>
//{
//    public async Task<Result<bool>> Handle(CreateNotificationTemplateDto command)
//    {
//        var entity = new NotificationTemplate
//        {
//            Title = command.Title,
//            Channel = command.Channel,
//            Content = command.Content,
//            ParametersJson = command.ParametersJson
//        };

//        await repo.CreateAsync(entity);
//        return Result<bool>.Success(true);
//    }

//    public async Task<Result<bool>> Handle(EditNotificationTemplateDto command)
//    {
//        var template = await repo.LoadAsync(command.Id);
//        if (template == null)
//            return Result<bool>.Failure(false, "Template not found");

//        template.Edit(command.Title, command.Content, command.Type);
//        repo.Update(template);
//        return Result<bool>.Success(true);
//    }
//}