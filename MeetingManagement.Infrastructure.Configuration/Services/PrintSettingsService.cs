using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.SettingAgg;
using MeetingManagement.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MeetingManagement.Infrastructure.Configuration.Services;

/// <summary>سربرگ ثابت همه‌ی چاپ‌ها</summary>
public sealed class PrintBranding
{
    [JsonPropertyName("companyName")] public string? CompanyName { get; set; }
    [JsonPropertyName("subtitle")] public string? Subtitle { get; set; }
    [JsonPropertyName("logoGuid")] public Guid? LogoGuid { get; set; }
    [JsonPropertyName("address")] public string? Address { get; set; }
    [JsonPropertyName("phone")] public string? Phone { get; set; }
    [JsonPropertyName("website")] public string? Website { get; set; }
    [JsonPropertyName("footerText")] public string? FooterText { get; set; }
    [JsonPropertyName("primaryColor")] public string? PrimaryColor { get; set; }
    [JsonPropertyName("fontFamily")] public string? FontFamily { get; set; }
    [JsonPropertyName("showPrintDate")] public bool ShowPrintDate { get; set; } = true;
    [JsonPropertyName("showPrintedBy")] public bool ShowPrintedBy { get; set; }
    [JsonPropertyName("watermark")] public string? Watermark { get; set; }
}

public sealed class PrintSettingsModel
{
    public PrintBranding Branding { get; set; } = new();

    /// <summary>کلید قالب ← شناسه فایل قالب در سامانه مدیریت فایل</summary>
    public Dictionary<string, Guid> Templates { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

/// <summary>
/// تنظیمات چاپ (سربرگ و قالب‌های سفارشی).
/// ستون مقدار SystemSettings حداکثر ۱۰۰۰ کاراکتر است؛ پس محتوای قالب‌ها به‌صورت فایل JSON در سامانه مدیریت فایل
/// ذخیره می‌شود و اینجا فقط شناسه‌ی فایل نگه داشته می‌شود (بدون تغییر اسکیما). هر ذخیره یک فایل جدید است (سابقه حفظ می‌شود).
/// </summary>
public sealed partial class PrintSettingsService(MeetingManagementCommandContext db)
{
    private const int MaxValueLength = 1000;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        PropertyNameCaseInsensitive = true,
    };

    [GeneratedRegex("^[a-z][a-z0-9-]{1,39}$")]
    private static partial Regex TemplateKeyRegex();

    [GeneratedRegex("^#[0-9a-fA-F]{6}$")]
    private static partial Regex ColorRegex();

    public async Task<PrintSettingsModel> GetAsync(CancellationToken ct = default)
    {
        var rows = await db.SystemSettings.AsNoTracking()
            .Where(s => s.Key == SettingKey.PrintBranding || s.Key == SettingKey.PrintTemplates)
            .ToListAsync(ct);

        return new PrintSettingsModel
        {
            Branding = Parse<PrintBranding>(rows.FirstOrDefault(r => r.Key == SettingKey.PrintBranding)?.Value) ?? new PrintBranding(),
            Templates = new Dictionary<string, Guid>(
                Parse<Dictionary<string, Guid>>(rows.FirstOrDefault(r => r.Key == SettingKey.PrintTemplates)?.Value) ?? [],
                StringComparer.OrdinalIgnoreCase),
        };
    }

    /// <returns>پیام خطا یا null</returns>
    public async Task<string?> SaveBrandingAsync(PrintBranding branding, Guid actor, CancellationToken ct = default)
    {
        branding.CompanyName = Clean(branding.CompanyName, 120);
        branding.Subtitle = Clean(branding.Subtitle, 120);
        branding.Address = Clean(branding.Address, 200);
        branding.Phone = Clean(branding.Phone, 60);
        branding.Website = Clean(branding.Website, 100);
        branding.FooterText = Clean(branding.FooterText, 200);
        branding.Watermark = Clean(branding.Watermark, 40);
        branding.FontFamily = Clean(branding.FontFamily, 60);
        if (branding.PrimaryColor is { Length: > 0 } color && !ColorRegex().IsMatch(color))
            return "رنگ باید به شکل #RRGGBB باشد.";
        if (branding.LogoGuid == Guid.Empty) branding.LogoGuid = null;

        var json = JsonSerializer.Serialize(branding, JsonOptions);
        if (json.Length > MaxValueLength)
            return "اطلاعات سربرگ بیش از ظرفیت مجاز است؛ متن‌ها را کوتاه‌تر کنید.";

        await UpsertAsync(SettingKey.PrintBranding, json, actor, ct);
        return null;
    }

    /// <param name="fileGuid">null = بازگشت به قالب پیش‌فرض</param>
    public async Task<string?> SetTemplateAsync(string key, Guid? fileGuid, Guid actor, CancellationToken ct = default)
    {
        key = (key ?? string.Empty).Trim().ToLowerInvariant();
        if (!TemplateKeyRegex().IsMatch(key))
            return "کلید قالب نامعتبر است.";

        var current = (await GetAsync(ct)).Templates;
        if (fileGuid is { } guid && guid != Guid.Empty) current[key] = guid;
        else current.Remove(key);

        var json = JsonSerializer.Serialize(current, JsonOptions);
        if (json.Length > MaxValueLength)
            return "تعداد قالب‌های سفارشی بیش از ظرفیت مجاز است.";

        await UpsertAsync(SettingKey.PrintTemplates, json, actor, ct);
        return null;
    }

    private async Task UpsertAsync(SettingKey key, string value, Guid actor, CancellationToken ct)
    {
        var row = await db.SystemSettings.FirstOrDefaultAsync(s => s.Key == key, ct);
        if (row is null)
        {
            db.SystemSettings.Add(new SystemSetting(actor, key, value, SettingValueType.Json, SettingCategory.Print,
                key.GetDescription(), "از صفحه «تنظیمات › چاپ و قالب‌ها» مدیریت می‌شود.", isPublic: false));
        }
        else
        {
            row.UpdateValue(actor, value);
        }

        await db.SaveChangesAsync(ct);
    }

    private static T? Parse<T>(string? json) where T : class
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return JsonSerializer.Deserialize<T>(json, JsonOptions); }
        catch (JsonException) { return null; }
    }

    private static string? Clean(string? value, int max)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var trimmed = value.Trim();
        return trimmed.Length <= max ? trimmed : trimmed[..max];
    }
}
