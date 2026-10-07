// SettingQueryFacade.cs
using Epc.Application.Command;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.SystemSetting;
using MeetingManagement.Infrastructure.Query.Contracts.Setting;
using MeetingManagement.Presentation.Facade.Contracts.Setting;
using System.Threading.Tasks;

namespace MeetingManagement.Presentation.Facade.Query;


public class SystemSettingCommandFacade(
    IResponsiveCommandBusAsync responsiveCommandBusAsync
) : ISystemSettingCommandFacade
{
    public async Task<Result<int>> Create(CreateSettingDto command)
        => await responsiveCommandBusAsync.Dispatch<CreateSettingDto, Result<int>>(command);

    public async Task<Result<bool>> Edit(EditSettingDto command)
        => await responsiveCommandBusAsync.Dispatch<EditSettingDto, Result<bool>>(command);

    public async Task<Result<bool>> UpdateValue(UpdateSettingValueDto command)
        => await responsiveCommandBusAsync.Dispatch<UpdateSettingValueDto, Result<bool>>(command);

    public async Task<Result<bool>> BulkUpdate(BulkUpdateSettingsDto command)
        => await responsiveCommandBusAsync.Dispatch<BulkUpdateSettingsDto, Result<bool>>(command);
}