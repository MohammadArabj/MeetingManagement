using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.SystemSetting;

public record UpdateSettingValueDto(
    byte Key,
    string Value
):ICommand;
