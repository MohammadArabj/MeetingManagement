using Epc.Application.Command;
using Epc.Company.Query;
using Epc.Identity;
using MeetingManagement.Application.Contracts.Setting;
using MeetingManagement.Application.Contracts.SystemSetting;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.SettingAgg;

namespace MeetingManagement.Application;

public class SystemSettingCommandHandler(
    ISystemSettingRepository repository,
    IClaimHelper claimHelper
) : ICommandHandlerAsync<CreateSettingDto, Result<int>>,
    ICommandHandlerAsync<EditSettingDto, Result<bool>>,
    ICommandHandlerAsync<UpdateSettingValueDto, Result<bool>>,
    ICommandHandlerAsync<BulkUpdateSettingsDto, Result<bool>>
{
    public async Task<Result<int>> Handle(CreateSettingDto command)
    {
        var existing = await repository.GetByKeyAsync((SettingKey)command.Key);
        if (existing != null)
            return Result<int>.Failure(0, "این تنظیم قبلاً ثبت شده است");

        var setting = new SystemSetting(
            claimHelper.GetCurrentUserGuid(),
            (SettingKey)command.Key,
            command.Value,
            (SettingValueType)command.ValueType,
            (SettingCategory)command.Category,
            command.DisplayName,
            command.Description,
            command.IsPublic
        );

        await repository.CreateAsync(setting);

        // آپدیت static values
        SettingValues.Update((SettingKey)command.Key, command.Value);

        return Result<int>.Success(setting.Id);
    }

    public async Task<Result<bool>> Handle(EditSettingDto command)
    {
        var setting = await repository.LoadAsync(command.Id);
        if (setting == null)
            return Result<bool>.Failure(false, "تنظیم مورد نظر یافت نشد");

        setting.Edit(
            claimHelper.GetCurrentUserGuid(),
            command.Value,
            command.DisplayName,
            command.Description,
            command.IsPublic
        );

        repository.Update(setting);

        // آپدیت static values
        SettingValues.Update(setting.Key, command.Value);

        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> Handle(UpdateSettingValueDto command)
    {
        var setting = await repository.GetByKeyAsync((SettingKey)command.Key);
        if (setting == null)
            return Result<bool>.Failure(false, "تنظیم مورد نظر یافت نشد");

        setting.UpdateValue(claimHelper.GetCurrentUserGuid(), command.Value);
        repository.Update(setting);

        // آپدیت static values
        SettingValues.Update((SettingKey)command.Key, command.Value);

        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> Handle(BulkUpdateSettingsDto command)
    {
        var updatedSettings = new List<(SettingKey Key, string Value)>();

        foreach (var item in command.Settings)
        {
            var key = (SettingKey)item.Key;

            // ✅ ردیف‌های داخلی (JSON نقش‌ها/نگاشت رویدادها/Watermark) فقط از API اختصاصی خودشان تغییر می‌کنند
            if (key is SettingKey.MeetingRoleConfig or SettingKey.NotificationEventMap or SettingKey.NotificationReminderWatermark)
                return Result<bool>.Failure(false, "این تنظیم از این بخش قابل ویرایش نیست.");

            var setting = await repository.GetByKeyAsync(key);
            if (setting == null) continue;

            var error = ValidateValue(setting, item.Value);
            if (error is not null)
                return Result<bool>.Failure(false, $"«{setting.DisplayName}»: {error}");

            setting.UpdateValue(claimHelper.GetCurrentUserGuid(), item.Value);
            repository.Update(setting);

            updatedSettings.Add(((SettingKey)item.Key, item.Value));
        }

        // آپدیت batch در static values
        SettingValues.UpdateMany(updatedSettings);

        return Result<bool>.Success(true);
    }

    /// <summary>اعتبارسنجی مقدار بر اساس نوع تنظیم (قبلاً هر رشته‌ای ذخیره می‌شد).</summary>
    private static string? ValidateValue(SystemSetting setting, string? value)
    {
        value ??= string.Empty;
        return setting.ValueType switch
        {
            SettingValueType.Integer when !int.TryParse(value, out var n) || n < 0 => "باید عدد صحیح نامنفی باشد.",
            SettingValueType.Boolean when !bool.TryParse(value, out _) => "مقدار باید true یا false باشد.",
            SettingValueType.Guid when value.Length > 0 && !Guid.TryParse(value, out _) => "شناسه (GUID) نامعتبر است.",
            SettingValueType.Decimal when !decimal.TryParse(value, out _) => "باید عدد باشد.",
            SettingValueType.Time when value.Length > 0 && !TimeSpan.TryParse(value, out _) => "ساعت باید به شکل HH:mm باشد.",
            _ when value.Length > 1000 => "حداکثر ۱۰۰۰ کاراکتر مجاز است.",
            _ => null,
        };
    }
}