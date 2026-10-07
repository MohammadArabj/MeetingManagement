using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.SystemSetting;

public record EditSettingDto(
    int Id,
    string Value,
    string DisplayName,
    string? Description,
    bool IsPublic
) : ICommand;
