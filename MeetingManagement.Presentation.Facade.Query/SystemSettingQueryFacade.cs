// SettingQueryFacade.cs
using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Infrastructure.Query.Contracts.SystemSetting;
using MeetingManagement.Presentation.Facade.Contracts.Setting;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace MeetingManagement.Presentation.Facade.Query;

public class SystemSettingQueryFacade(IQueryBusAsync queryBus) : ISystemSettingQueryFacade
{
    public async Task<Result<List<SettingJsonModel>>> GetAll()
        => await queryBus.Dispatch<Result<List<SettingJsonModel>>>();

    public async Task<Result<SettingJsonModel>> GetById(int id)
        => await queryBus.Dispatch<Result<SettingJsonModel>, int>(id);

    public async Task<Result<List<SettingJsonModel>>> GetByCategory(byte category)
        => await queryBus.Dispatch<Result<List<SettingJsonModel>>, SettingCategoryDto>(
            new SettingCategoryDto { Category = category });

    public async Task<Result<List<SettingPublicModel>>> GetPublicSettings()
        => await queryBus.Dispatch<Result<List<SettingPublicModel>>>();
}
