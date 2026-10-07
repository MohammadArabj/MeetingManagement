using System.Collections.Generic;
using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.Setting;

public class UpdateSetting : ICommand
{
    public List<SettingItem> Items { get; set; } = [];

}