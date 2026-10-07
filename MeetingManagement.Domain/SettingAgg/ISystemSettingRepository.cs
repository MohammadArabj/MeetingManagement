using Epc.Domain;
using MeetingManagement.Common.Extensions;

namespace MeetingManagement.Domain.SettingAgg;

public interface ISystemSettingRepository : IRepository<int, SystemSetting>
{
    Task<SystemSetting?> GetByKeyAsync(SettingKey key);
    Task<List<SystemSetting>> GetAllAsync();
    Task<List<SystemSetting>> GetPublicSettingsAsync();
    Task<List<SystemSetting>> GetByCategoryAsync(SettingCategory category);
}