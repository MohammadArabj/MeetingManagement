using Epc.Application.Setting;
using Epc.Dapper;
using EPC.SSO.SettingModels;
using Microsoft.AspNetCore.Authorization;
using EPC.SSO.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using UserManagement.Infrastructure.Persistence;

namespace EPC.SSO.Quickstart.Settings;

[SecurityHeaders]
[Authorize]
[RequireSuperAdmin]
public class SettingsController(
    ISettingService settingService,
    BaseDapperRepository repository,
    IMemoryCache cache) : Controller
{
    // ══════════════════════════════════════════════════════════════════════════
    //  INDEX
    // ══════════════════════════════════════════════════════════════════════════
    [HttpGet]
    public IActionResult Index()
    {
        var model = new SettingsPageViewModel
        {
            Security = settingService.Fetch<SecuritySettingViewModel>(),
            Announcement = settingService.Fetch<AnnouncementSettingViewModel>(),
        };
        return View(model);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  ذخیره‌ی تنظیمات امنیتی
    // ══════════════════════════════════════════════════════════════════════════
    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult SaveSecurity(SecuritySettingViewModel model)
    {
        if (model.TokenExpiryTime <= 0 ||
            model.LoginAttemptsCountLimit <= 0 ||
            model.PasswordLifetimeDays <= 0 ||
            model.ForbiddenOldPasswordsCount < 0 ||
            model.PasswordStrengthLevel <= 0 ||
            model.MaxLoginAttemptsBeforeCaptcha <= 0)
        {
            TempData["SettingsError"] = "مقادیر وارد شده برای تنظیمات امنیتی نامعتبر است.";
            return RedirectToAction(nameof(Index));
        }

        SaveBySettingName(BuildItems<SecuritySettingViewModel>(model));
        CachedSettingService.Invalidate<SecuritySettingViewModel>(cache);

        // TokenExpiryTime فقط هنگام شروع برنامه روی Clientهای IdentityServer اعمال می‌شود
        TempData["SettingsSuccess"] = "تنظیمات امنیتی با موفقیت ذخیره شد. تغییر مدت اعتبار توکن پس از راه‌اندازی مجدد سامانه اعمال می‌شود.";
        return RedirectToAction(nameof(Index));
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  ذخیره‌ی تنظیمات اطلاعیه‌ها
    // ══════════════════════════════════════════════════════════════════════════
    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult SaveAnnouncement(AnnouncementSettingViewModel model)
    {
        if (model.DashboardAnnouncementCount <= 0 ||
            model.LoginAnnouncementSlideIntervalSeconds <= 0)
        {
            TempData["SettingsError"] = "مقادیر تنظیمات اطلاعیه‌ها باید عددی مثبت باشند.";
            return RedirectToAction(nameof(Index));
        }

        SaveBySettingName(BuildItems<AnnouncementSettingViewModel>(model));
        CachedSettingService.Invalidate<AnnouncementSettingViewModel>(cache);

        TempData["SettingsSuccess"] = "تنظیمات اطلاعیه‌ها با موفقیت ذخیره شد.";
        return RedirectToAction(nameof(Index));
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  متدهای کمکی خصوصی
    // ══════════════════════════════════════════════════════════════════════════

    /// <summary>
    /// reflection روی ViewModel می‌زند و هر property را با [SettingName] آن
    /// به یک SettingItem تبدیل می‌کند — دقیقاً همان ساختار UpdateSetting.
    /// </summary>
    private static List<SettingItem> BuildItems<T>(T model) where T : ISetting
    {
        var items = new List<SettingItem>();

        foreach (var prop in typeof(T).GetProperties())
        {
            var attr = (SettingNameAttribute?)prop
                .GetCustomAttributes(typeof(SettingNameAttribute), false)
                .FirstOrDefault();

            if (attr is null) continue;

            items.Add(new SettingItem
            {
                SettingName = attr.Value,
                FieldType = prop.PropertyType == typeof(bool) ? "bit" : "nvarchar",
                Value = Convert.ToString(prop.GetValue(model)) ?? string.Empty,
            });
        }

        return items;
    }

    /// <summary>
    /// همان منطق UpdateSetting — ولی با Name جستجو می‌کند نه Id مستقیم،
    /// چون Id ها در این controller در دسترس نیستند.
    /// </summary>
    private void SaveBySettingName(List<SettingItem> items)
    {
        foreach (var item in items)
        {
            // پارامتری (قبلاً مقدار و نام داخل رشته‌ی SQL قرار می‌گرفت؛ مقدار bool هم کوئری نامعتبر می‌ساخت)
            const string sql = """
                IF EXISTS (
                    SELECT 1
                    FROM   SettingDetails sd
                    JOIN   Settings s ON s.Id = sd.SettingId
                    WHERE  s.Name = @Name
                )
                BEGIN
                    UPDATE sd
                    SET    sd.Value = @Value
                    FROM   SettingDetails sd
                    JOIN   Settings s ON s.Id = sd.SettingId
                    WHERE  s.Name = @Name
                END
                ELSE
                BEGIN
                    INSERT INTO SettingDetails (SettingId, Value)
                    SELECT s.Id, @Value
                    FROM   Settings s
                    WHERE  s.Name = @Name
                END
                """;

            repository.Execute(sql, new { Name = item.SettingName, Value = item.Value });
        }
    }
}

// ══════════════════════════════════════════════════════════════════════════════
//  DTO داخلی (همان شکل UpdateSetting ولی با Name به جای Id)
// ══════════════════════════════════════════════════════════════════════════════
class SettingItem
{
    public string SettingName { get; set; } = default!;
    public string FieldType { get; set; } = default!;
    public string Value { get; set; } = default!;
}

// ══════════════════════════════════════════════════════════════════════════════
//  ViewModel صفحه‌ی تنظیمات
// ══════════════════════════════════════════════════════════════════════════════
public class SettingsPageViewModel
{
    public SecuritySettingViewModel Security { get; set; } = new();
    public AnnouncementSettingViewModel Announcement { get; set; } = new();
}