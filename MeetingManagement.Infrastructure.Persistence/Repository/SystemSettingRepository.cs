using Epc.EntityFramework;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.SettingAgg;
using Microsoft.EntityFrameworkCore;

namespace MeetingManagement.Infrastructure.Persistence.Repository;

public class SystemSettingRepository(DbContext commandContext)
    : BaseRepository<int, SystemSetting>(commandContext), ISystemSettingRepository
{
    public async Task<SystemSetting?> GetByKeyAsync(SettingKey key)
    {
        return await commandContext.Set<SystemSetting>()
            .FirstOrDefaultAsync(s => s.Key == key);
    }

    public async Task<List<SystemSetting>> GetAllAsync()
    {
        return await commandContext.Set<SystemSetting>()
            .OrderBy(s => s.Category)
            .ThenBy(s => s.Key)
            .ToListAsync();
    }

    public async Task<List<SystemSetting>> GetPublicSettingsAsync()
    {
        return await commandContext.Set<SystemSetting>()
            .Where(s => s.IsPublic)
            .OrderBy(s => s.Category)
            .ThenBy(s => s.Key)
            .ToListAsync();
    }

    public async Task<List<SystemSetting>> GetByCategoryAsync(SettingCategory category)
    {
        return await commandContext.Set<SystemSetting>()
            .Where(s => s.Category == category)
            .OrderBy(s => s.Key)
            .ToListAsync();
    }
}