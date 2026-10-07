using Epc.Application.Query;
using Epc.Company.Query;
using Epc.Domain;
using MeetingManagement.Application.Contracts.NotificationSetting;
using MeetingManagement.Domain.NotificationSettingAgg;
using MeetingManagement.Domain.NotificationTemplateAgg;

namespace MeetingManagement.Application;

//public class NotificationSettingCommandHandler(INotificationSettingRepository repository):
//    IQueryHandlerAsync<Result<bool>, CreateNotificationSettingDto>,
//    IQueryHandlerAsync<Result<bool>, EditNotificationSettingDto>
//{
//    public async Task<Result<bool>> Handle(CreateNotificationSettingDto command)
//    {
//        var setting = new NotificationSetting(command.StatusId, command.SendType, command.NotificationTemplateId, command.ReminderHoursBefore);
//        await repository.CreateAsync(setting);
//        return Result<bool>.Success(true);
//    }

//    public async Task<Result<bool>> Handle(EditNotificationSettingDto command)
//    {
//        var setting = await repository.LoadAsync(command.Id);
//        if (setting == null)
//            return Result<bool>.Failure(false, "Setting not found");

//        setting.Edit(command.StatusId, command.SendType, command.NotificationTemplateId, command.ReminderHoursBefore);
//        repository.Update(setting);
//        return Result<bool>.Success(true);
//    }
//}