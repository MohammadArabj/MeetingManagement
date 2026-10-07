using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.SystemSetting;

public record CreateSettingDto(
    byte Key,
    string Value,
    byte ValueType,
    byte Category,
    string DisplayName,
    string? Description,
    bool IsPublic = true
):ICommand;
