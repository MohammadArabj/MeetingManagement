// ISettingQueryFacade.cs
using Epc.Company.Query;
using MeetingManagement.Infrastructure.Query.Contracts.SystemSetting;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace MeetingManagement.Presentation.Facade.Contracts.Setting;

public interface ISystemSettingQueryFacade
{
    Task<Result<List<SettingJsonModel>>> GetAll();
    Task<Result<SettingJsonModel>> GetById(int id);
    Task<Result<List<SettingJsonModel>>> GetByCategory(byte category);
    Task<Result<List<SettingPublicModel>>> GetPublicSettings();
}