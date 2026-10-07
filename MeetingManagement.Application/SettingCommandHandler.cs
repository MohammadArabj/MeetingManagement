using Epc.Application.Command;
using Epc.Dapper;
using MeetingManagement.Application.Contracts.Setting;

namespace MeetingManagement.Application;

public class SettingCommandHandler(BaseDapperRepository repository) : ICommandHandler<UpdateSetting>
{
    public void Handle(UpdateSetting command)
    {
        foreach (var item in command.Items)
        {
            var sql = "UPDATE SettingDetails SET VALUE =";

            if (item.FieldType == "bit")
                sql += $" {item.Value} ";
            else
                sql += $" '{item.Value}' ";

            sql += $"WHERE SettingId = {item.SettingId}";

            repository.Execute(sql);
        }
    }
}