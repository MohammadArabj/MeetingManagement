using Epc.Application.Command;
using System.Collections.Generic;

namespace MeetingManagement.Application.Contracts.SystemSetting;

public record BulkUpdateSettingsDto(
    List<UpdateSettingValueDto> Settings
):ICommand;