using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.SettingAgg;
using MeetingManagement.Infrastructure.Configuration.Service;
using MeetingManagement.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace MeetingManagement.Application.Services;

public class SettingInitializationService(
    IServiceProvider serviceProvider,
    ILogger<SettingInitializationService> logger
) : ISystemSettingInitializationService
{
    public async Task InitializeAsync()
    {
        try
        {
            using var scope = serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<MeetingManagementQueryContext>();

            var settings = await context.SystemSettings.ToListAsync();

            if (settings.Any())
            {
                SettingValues.Initialize(settings);
                logger.LogInformation("Settings initialized successfully. Count: {Count}", settings.Count);
            }
            else
            {
                logger.LogWarning("No settings found in database. Run SeedDefaultSettings first.");
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error initializing settings");
            throw;
        }
    }

    public async Task SeedDefaultSettingsAsync()
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<MeetingManagementCommandContext>();

        var existingKeys = await context.Set<SystemSetting>()
            .Select(s => s.Key)
            .ToListAsync();

        var defaultSettings = GetDefaultSettings()
            .Where(s => !existingKeys.Contains(s.Key))
            .ToList();

        if (defaultSettings.Any())
        {
            await context.Set<SystemSetting>().AddRangeAsync(defaultSettings);
            await context.SaveChangesAsync();

            logger.LogInformation("Seeded {Count} default settings", defaultSettings.Count);
        }

        // ✅ SystemGuid برای ردیف‌های بعدی لازم است
        var systemGuidRow = await context.Set<SystemSetting>().AsNoTracking()
            .FirstOrDefaultAsync(s => s.Key == SettingKey.SystemGuid);
        if (systemGuidRow is not null) SettingValues.Update(SettingKey.SystemGuid, systemGuidRow.Value);

        // ✅ نقش‌ها و رویدادهای اطلاع‌رسانی (فقط داده؛ بدون تغییر اسکیما)
        await MeetingDataSeeder.SeedAsync(context, logger);
    }

    private static List<SystemSetting> GetDefaultSettings()
    {
        var systemGuid = Guid.Parse("00000000-0000-0000-0000-000000000001");

        return
        [
            // هیئت مدیره
            new(systemGuid, SettingKey.BoardCategoryGuid,
                "fa370076-d2a9-4546-b00c-71de1a370306",
                SettingValueType.Guid, SettingCategory.BoardMeeting,
                "کد دسته‌بندی هیئت مدیره"),

            new(systemGuid, SettingKey.BoardPositionGuid,
                "",
                SettingValueType.Guid, SettingCategory.BoardMeeting,
                "کد سمت هیئت مدیره"),

            new(systemGuid, SettingKey.BoardSecretaryUserGuid,
                "",
                SettingValueType.Guid, SettingCategory.BoardMeeting,
                "کد کاربر دبیر هیئت مدیره"),

            // کمیسیون معاملات
            new(systemGuid, SettingKey.CommitteeCategoryGuid,
                "ea232fb3-08ae-402b-9fd6-f7758965e410",
                SettingValueType.Guid, SettingCategory.BoardMeeting,
                "کد دسته‌بندی کمیسیون معاملات"),

            // جلسه
            new(systemGuid, SettingKey.MeetingUndeterminedAfterDays, "0",
                SettingValueType.Integer, SettingCategory.Meeting,
                "تعیین تکلیف نشده خودکار (روز)", "جلسات «ثبت اولیه» یا «برگزار شده» که این تعداد روز از تاریخشان گذشته و نهایی نشده‌اند، «تعیین تکلیف نشده» می‌شوند. 0 = غیرفعال"),

            new(systemGuid, SettingKey.MeetingAutoCloseMinutes,
                "30",
                SettingValueType.Integer, SettingCategory.Meeting,
                "مدت زمان اتمام خودکار جلسه پس از امضا (دقیقه)"),

            new(systemGuid, SettingKey.MaxResolutionAttachments,
                "10",
                SettingValueType.Integer, SettingCategory.FileManagement,
                "حداکثر تعداد فایل پیوست در هر مصوبه"),

            new(systemGuid, SettingKey.MaxAttachmentSizeMB,
                "50",
                SettingValueType.Integer, SettingCategory.FileManagement,
                "حداکثر حجم فایل پیوست (مگابایت)"),

            // سیستم
            new(systemGuid, SettingKey.SystemGuid,
                "d4498b9d-fe54-4c65-b1d3-35022dab7dbb",
                SettingValueType.Guid, SettingCategory.General,
                "کد سیستم"),

            new(systemGuid, SettingKey.SmsUrl,
                "http://sms.epciran.ir",
                SettingValueType.String, SettingCategory.Notification,
                "آدرس پنل پیامک"),

            new(systemGuid, SettingKey.SystemName,
                "سامانه مدیریت جلسات",
                SettingValueType.String, SettingCategory.General,
                "نام سیستم"),

            // نوتیفیکیشن
            new(systemGuid, SettingKey.SmsEnabled,
                "true",
                SettingValueType.Boolean, SettingCategory.Notification,
                "فعال بودن ارسال پیامک"),

            // ── کلیدهای جدید ────────────────────────────────────────────
            new(systemGuid, SettingKey.SystemBaseUrl, "",
                SettingValueType.String, SettingCategory.General, "آدرس عمومی سامانه",
                "برای ساخت لینک در پیامک‌ها، مثلاً http://meeting.epciran.ir"),

            new(systemGuid, SettingKey.MeetingReminderHoursBefore, "24",
                SettingValueType.Integer, SettingCategory.Notification, "یادآوری جلسه (ساعت قبل)", "۰ = غیرفعال"),

            new(systemGuid, SettingKey.AssignmentDueReminderDaysBefore, "2",
                SettingValueType.Integer, SettingCategory.Notification, "یادآوری سررسید تخصیص (روز قبل)", "۰ = غیرفعال"),

            new(systemGuid, SettingKey.NotificationMaxRetry, "3",
                SettingValueType.Integer, SettingCategory.Notification, "حداکثر تلاش مجدد ارسال پیامک"),

            new(systemGuid, SettingKey.NotificationQuietStart, "22:00",
                SettingValueType.Time, SettingCategory.Notification, "شروع ساعات سکوت پیامک"),

            new(systemGuid, SettingKey.NotificationQuietEnd, "07:00",
                SettingValueType.Time, SettingCategory.Notification, "پایان ساعات سکوت پیامک"),

            new(systemGuid, SettingKey.InAppNotificationEnabled, "true",
                SettingValueType.Boolean, SettingCategory.Notification, "اعلان داخل سامانه"),

            new(systemGuid, SettingKey.SmsTestMode, "false",
                SettingValueType.Boolean, SettingCategory.Notification, "حالت آزمایشی پیامک", "فقط ثبت در لاگ؛ بدون ارسال واقعی"),

            new(systemGuid, SettingKey.ReferralMaxDepth, "5",
                SettingValueType.Integer, SettingCategory.Resolution, "حداکثر عمق ارجاع"),

            new(systemGuid, SettingKey.ReferralAllowLaterDueDate, "false",
                SettingValueType.Boolean, SettingCategory.Resolution, "اجازه مهلت ارجاع دیرتر از مهلت والد"),

            // چاپ
            new(systemGuid, SettingKey.PrintBranding, "{\"companyName\":\"شرکت پتروشیمی اصفهان\",\"showPrintDate\":true}",
                SettingValueType.Json, SettingCategory.Print, "سربرگ چاپ", "از صفحه «تنظیمات › چاپ و قالب‌ها» مدیریت می‌شود."),

            new(systemGuid, SettingKey.PrintTemplates, "{}",
                SettingValueType.Json, SettingCategory.Print, "قالب‌های سفارشی چاپ", "داخلی - از صفحه «تنظیمات › چاپ و قالب‌ها» مدیریت می‌شود."),

            new(systemGuid, SettingKey.AllowedFileExtensions,
                ".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar",
                SettingValueType.String, SettingCategory.FileManagement,
                "فرمت های مجاز آپلود"),
        ];
    }
}