// ISettingQueryFacade.cs
using Epc.Company.Query;
using Epc.Core;
using MeetingManagement.Application.Contracts.SystemSetting;
using MeetingManagement.Infrastructure.Query.Contracts.Setting;
using System.Threading.Tasks;

namespace MeetingManagement.Presentation.Facade.Contracts.Setting;

public interface ISystemSettingCommandFacade:IFacadeService
{
    Task<Result<int>> Create(CreateSettingDto command);
    Task<Result<bool>> Edit(EditSettingDto command);
    Task<Result<bool>> UpdateValue(UpdateSettingValueDto command);
    Task<Result<bool>> BulkUpdate(BulkUpdateSettingsDto command);
}