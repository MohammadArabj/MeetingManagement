using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.SettingAgg;
using MeetingManagement.Infrastructure.Persistence;
using MeetingManagement.Infrastructure.Query.Contracts.Setting;
using MeetingManagement.Infrastructure.Query.Contracts.SystemSetting;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace MeetingManagement.Infrastructure.Query;

public class SystemSettingQueryHandler(MeetingManagementQueryContext context)
    : IQueryHandlerAsync<Result<List<SettingJsonModel>>>,
      IQueryHandlerAsync<Result<SettingJsonModel>, int>,
      IQueryHandlerAsync<Result<List<SettingJsonModel>>, SettingCategoryDto>,
      IQueryHandlerAsync<Result<List<SettingPublicModel>>>
{
    // لیست همه تنظیمات (برای ادمین)
    public async Task<Result<List<SettingJsonModel>>> Handle()
    {
        var settings = await context.SystemSettings
            .Where(s => s.ValueType != SettingValueType.Json && s.Key != SettingKey.NotificationReminderWatermark) // ردیف‌های داخلی در صفحه تنظیمات نمایش داده نمی‌شوند
            .OrderBy(s => s.Category)
            .ThenBy(s => s.Key)
            .Select(s => new SettingJsonModel
            {
                Id = s.Id,
                Key = (byte)s.Key,
                KeyName = s.Key.ToString(),
                Value = s.Value,
                ValueType = (byte)s.ValueType,
                ValueTypeName = s.ValueType.ToString(),
                Category = (byte)s.Category,
                CategoryName = s.Category.ToString(),
                DisplayName = s.DisplayName,
                Description = s.Description,
                IsPublic = s.IsPublic,
            })
            .ToListAsync();

        return Result<List<SettingJsonModel>>.EmptyMessage(settings);
    }

    // دریافت یک تنظیم با Id
    public async Task<Result<SettingJsonModel>> Handle(int id)
    {
        var setting = await context.SystemSettings
            .Where(s => s.ValueType != SettingValueType.Json && s.Key != SettingKey.NotificationReminderWatermark) // ردیف‌های داخلی در صفحه تنظیمات نمایش داده نمی‌شوند
            .Where(s => s.Id == id)
            .Select(s => new SettingJsonModel
            {
                Id = s.Id,
                Key = (byte)s.Key,
                KeyName = s.Key.ToString(),
                Value = s.Value,
                ValueType = (byte)s.ValueType,
                ValueTypeName = s.ValueType.ToString(),
                Category = (byte)s.Category,
                CategoryName = s.Category.ToString(),
                DisplayName = s.DisplayName,
                Description = s.Description,
                IsPublic = s.IsPublic,
            })
            .FirstOrDefaultAsync();

        return setting == null
            ? Result<SettingJsonModel>.Failure(null!, "تنظیم مورد نظر یافت نشد")
            : Result<SettingJsonModel>.EmptyMessage(setting);
    }

    // لیست تنظیمات بر اساس دسته‌بندی
    public async Task<Result<List<SettingJsonModel>>> Handle(SettingCategoryDto condition)
    {
        var category = (SettingCategory)condition.Category;

        var settings = await context.SystemSettings
            .Where(s => s.ValueType != SettingValueType.Json && s.Key != SettingKey.NotificationReminderWatermark) // ردیف‌های داخلی در صفحه تنظیمات نمایش داده نمی‌شوند
            .Where(s => s.Category == category)
            .OrderBy(s => s.Key)
            .Select(s => new SettingJsonModel
            {
                Id = s.Id,
                Key = (byte)s.Key,
                KeyName = s.Key.ToString(),
                Value = s.Value,
                ValueType = (byte)s.ValueType,
                ValueTypeName = s.ValueType.ToString(),
                Category = (byte)s.Category,
                CategoryName = s.Category.ToString(),
                DisplayName = s.DisplayName,
                Description = s.Description,
                IsPublic = s.IsPublic,
            })
            .ToListAsync();

        return Result<List<SettingJsonModel>>.EmptyMessage(settings);
    }

    // تنظیمات عمومی (برای فرانت‌اند)
    async Task<Result<List<SettingPublicModel>>> IQueryHandlerAsync<Result<List<SettingPublicModel>>>.Handle()
    {
        var settings = await context.SystemSettings
            .Where(s => s.ValueType != SettingValueType.Json && s.Key != SettingKey.NotificationReminderWatermark) // ردیف‌های داخلی در صفحه تنظیمات نمایش داده نمی‌شوند
            .Where(s => s.IsPublic)
            .Select(s => new SettingPublicModel
            {
                Key = s.Key.ToString(),
                Value = s.Value,
                ValueType = (byte)s.ValueType
            })
            .ToListAsync();

        return Result<List<SettingPublicModel>>.EmptyMessage(settings);
    }
}