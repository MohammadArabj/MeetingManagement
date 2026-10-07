using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.NotificationEventAgg;
using MeetingManagement.Domain.NotificationSettingAgg;
using MeetingManagement.Domain.NotificationTemplateAgg;
using MeetingManagement.Domain.RoleAgg;
using MeetingManagement.Domain.SettingAgg;
using MeetingManagement.Domain.Shared.Access;
using MeetingManagement.Domain.Shared.Notifications;
using MeetingManagement.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace MeetingManagement.Infrastructure.Configuration.Service;

/// <summary>
/// Seed داده‌های لازم برای نقش‌ها و اطلاع‌رسانی — فقط «داده»، بدون هیچ تغییری در اسکیما.
/// Idempotent است: در هر بار اجرای برنامه فقط موارد ناموجود را می‌سازد.
/// </summary>
public static class MeetingDataSeeder
{
    public static async Task SeedAsync(MeetingManagementCommandContext db, ILogger logger, CancellationToken ct = default)
    {
        await SeedRoleConfigAsync(db, logger, ct);
        await SeedNotificationEventsAsync(db, logger, ct);
    }

    // ═══════════════════════════════════════════════════════════
    // نقش‌ها
    // ═══════════════════════════════════════════════════════════
    private static async Task SeedRoleConfigAsync(MeetingManagementCommandContext db, ILogger logger, CancellationToken ct)
    {
        var row = await db.SystemSettings.FirstOrDefaultAsync(s => s.Key == SettingKey.MeetingRoleConfig, ct);
        var roles = await db.Set<Role>().AsNoTracking().Select(r => new { r.Id, r.Title }).ToListAsync(ct);

        var existing = MeetingRoles.TryParse(row?.Value) ?? [];
        var definitions = existing.Where(d => roles.Any(r => r.Id == d.RoleId)).ToList();

        // نقش‌هایی که هنوز تعریف ندارند (نقش‌های قدیمی یا تازه ساخته‌شده)
        var order = definitions.Count == 0 ? 0 : definitions.Max(d => d.Order);
        foreach (var role in roles.Where(r => definitions.All(d => d.RoleId != r.Id)).OrderBy(r => r.Id))
        {
            var key = GuessKey(role.Id, role.Title, definitions);
            definitions.Add(MeetingRoles.CreateDefault(role.Id, key, ++order));
        }

        var json = MeetingRoles.Serialize(definitions);
        if (row is null)
        {
            db.SystemSettings.Add(new SystemSetting(SettingValues.SystemGuid, SettingKey.MeetingRoleConfig, json,
                SettingValueType.Json, SettingCategory.Roles, "پیکربندی نقش‌های جلسه",
                "توسط صفحه «نقش‌ها و دسترسی‌ها» مدیریت می‌شود.", isPublic: false));
            logger.LogInformation("Meeting role configuration seeded for {Count} roles", definitions.Count);
        }
        else if (row.Value != json)
        {
            row.UpdateValue(SettingValues.SystemGuid, json);
        }

        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// تشخیص کلید سیستمی از روی عنوان نقش (اولویت) و در غیر این صورت از قرارداد قدیمی Id ها.
    /// </summary>
    private static MeetingRoleKey GuessKey(int id, string? title, List<MeetingRoleDefinition> taken)
    {
        var t = (title ?? string.Empty).Replace('ي', 'ی').Replace('ك', 'ک').Replace("\u200c", " ").Trim();

        MeetingRoleKey key =
            t.Contains("رئیس") || t.Contains("رییس") ? MeetingRoleKey.Chairman :
            t.Contains("دبیر") && t.Contains("غیر") ? MeetingRoleKey.NonMemberSecretary :
            t.Contains("دبیر") ? MeetingRoleKey.Secretary :
            t.Contains("ناظر") ? MeetingRoleKey.Observer :
            t.Contains("مهمان") ? MeetingRoleKey.Guest :
            t.Contains("عضو") ? MeetingRoleKey.Member :
            id switch
            {
                1 => MeetingRoleKey.Secretary,
                2 => MeetingRoleKey.NonMemberSecretary,
                3 => MeetingRoleKey.Chairman,
                4 => MeetingRoleKey.Observer,
                5 => MeetingRoleKey.Member,
                6 => MeetingRoleKey.Guest,
                _ => MeetingRoleKey.Custom,
            };

        return key != MeetingRoleKey.Custom && taken.Any(d => d.Key == key) ? MeetingRoleKey.Custom : key;
    }

    // ═══════════════════════════════════════════════════════════
    // رویدادهای اطلاع‌رسانی
    // ═══════════════════════════════════════════════════════════
    private static async Task SeedNotificationEventsAsync(MeetingManagementCommandContext db, ILogger logger, CancellationToken ct)
    {
        var mapRow = await db.SystemSettings.FirstOrDefaultAsync(s => s.Key == SettingKey.NotificationEventMap, ct);
        NotificationEventMap.Load(mapRow?.Value);
        var map = NotificationEventMap.Current.ToDictionary(kv => kv.Key, kv => kv.Value);

        var events = await db.NotificationEvents.ToListAsync(ct);
        var created = 0;

        foreach (var def in NotificationEventCatalog.All)
        {
            if (map.TryGetValue(def.Code, out var id) && events.Any(e => e.Id == id))
                continue;

            var ev = events.FirstOrDefault(e => e.Title == def.Title);
            if (ev is null)
            {
                ev = new NotificationEvent
                {
                    Title = def.Title,
                    Description = $"رویداد سیستمی ({def.Code})",
                    IsScheduled = def.IsScheduled,
                };
                db.NotificationEvents.Add(ev);
                await db.SaveChangesAsync(ct);
                events.Add(ev);
                created++;
            }

            map[def.Code] = ev.Id;

            var hasSetting = await db.NotificationSettings.AnyAsync(s => s.NotificationEventId == ev.Id, ct);
            if (!hasSetting)
            {
                var template = await db.NotificationTemplates.FirstOrDefaultAsync(t => t.NotificationEventId == ev.Id, ct);
                if (template is null)
                {
                    template = new NotificationTemplate
                    {
                        Title = $"قالب پیش‌فرض - {def.Title}",
                        Content = def.DefaultTemplate,
                        NotificationEventId = ev.Id,
                    };
                    db.NotificationTemplates.Add(template);
                    await db.SaveChangesAsync(ct);
                }

                // ⚠️ پیامک به‌صورت پیش‌فرض خاموش است تا پس از استقرار پیامک انبوه ناخواسته ارسال نشود؛
                // از صفحه تنظیمات > اطلاع‌رسانی فعال کنید.
                db.NotificationSettings.Add(new NotificationSetting
                {
                    NotificationEventId = ev.Id,
                    NotificationTemplateId = template.Id,
                    IsSmsEnabled = false,
                    IsNotificationEnabled = def.InAppByDefault,
                    SendToAllParticipants = true,
                });
            }
        }

        var json = NotificationEventMap.Serialize(map);
        if (mapRow is null)
            db.SystemSettings.Add(new SystemSetting(SettingValues.SystemGuid, SettingKey.NotificationEventMap, json,
                SettingValueType.Json, SettingCategory.Notification, "نگاشت رویدادهای اطلاع‌رسانی", "داخلی - ویرایش نکنید", isPublic: false));
        else if (mapRow.Value != json)
            mapRow.UpdateValue(SettingValues.SystemGuid, json);

        await db.SaveChangesAsync(ct);
        NotificationEventMap.Load(json);

        if (created > 0) logger.LogInformation("Seeded {Count} notification events", created);
    }
}
