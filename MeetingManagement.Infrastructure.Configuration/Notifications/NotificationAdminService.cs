using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.NotificationTemplateAgg;
using MeetingManagement.Domain.NotificationSettingAgg;
using MeetingManagement.Domain.SettingAgg;
using MeetingManagement.Domain.Shared.Notifications;
using MeetingManagement.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System;
using System.Threading.Tasks;
using System.Linq;
using System.Threading;

namespace MeetingManagement.Infrastructure.Configuration.Notifications;

// ═══════════════════════════════════════════════════════════════════════════
//  مدل‌های API
// ═══════════════════════════════════════════════════════════════════════════
public sealed class NotificationEventModel
{
    public string Code { get; set; } = string.Empty;
    public short CodeValue { get; set; }
    public int EventId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Group { get; set; } = string.Empty;
    public bool IsScheduled { get; set; }
    public List<string> DefaultRecipients { get; set; } = [];
    public int? SettingId { get; set; }
    public bool IsSmsEnabled { get; set; }
    public bool IsNotificationEnabled { get; set; }
    public bool SendToAllParticipants { get; set; }
    public bool SupportsAllParticipants { get; set; }
    public int? TemplateId { get; set; }
    public string? TemplateContent { get; set; }
    public string DefaultTemplate { get; set; } = string.Empty;
    public List<NotificationTemplateModel> Templates { get; set; } = [];
    public int SentLast30Days { get; set; }
    public int FailedLast30Days { get; set; }
}

public sealed class NotificationTemplateModel
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string EventCode { get; set; } = string.Empty;
    public bool InUse { get; set; }
}

public sealed class UpdateEventSettingModel
{
    public string Code { get; set; } = string.Empty;
    public bool IsSmsEnabled { get; set; }
    public bool IsNotificationEnabled { get; set; }
    public bool SendToAllParticipants { get; set; }
    public int? TemplateId { get; set; }
}

public sealed class SaveTemplateModel
{
    public int? Id { get; set; }
    public string EventCode { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    /// <summary>پس از ذخیره، به‌عنوان قالب فعال رویداد انتخاب شود</summary>
    public bool SetActive { get; set; }
}

public sealed class TemplatePreviewModel
{
    public string Content { get; set; } = string.Empty;
}

public sealed class TemplatePreviewResult
{
    public string Rendered { get; set; } = string.Empty;
    public int Length { get; set; }
    public int SmsParts { get; set; }
    public List<string> UnknownPlaceholders { get; set; } = [];
}

public sealed class NotificationLogSearchModel
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string? Status { get; set; }
    public string? EventCode { get; set; }
    public string? Receiver { get; set; }
    public DateTime? From { get; set; }
    public DateTime? To { get; set; }
}

public sealed class NotificationLogModel
{
    public long Id { get; set; }
    public string EventTitle { get; set; } = string.Empty;
    public string Channel { get; set; } = string.Empty;
    public string Receiver { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int Attempts { get; set; }
    public DateTime SentAt { get; set; }
    public string? ErrorMessage { get; set; }
}

public sealed class NotificationLogPage
{
    public List<NotificationLogModel> Items { get; set; } = [];
    public int Total { get; set; }
    public Dictionary<string, int> StatusCounts { get; set; } = [];
}

public sealed class TestSmsModel
{
    public string Mobile { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
}

public sealed class AlarmModel
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }
    public DateTime? ExpireAt { get; set; }
}

/// <summary>
/// منطق صفحه «تنظیمات › اطلاع‌رسانی» و زنگوله اعلان‌ها.
/// </summary>
public sealed class NotificationAdminService(MeetingManagementCommandContext db, ISmsSender smsSender)
{
    private static readonly HashSet<NotificationEventCode> MeetingEvents =
    [
        NotificationEventCode.MeetingCreated, NotificationEventCode.MeetingRescheduled, NotificationEventCode.MeetingCanceled,
        NotificationEventCode.MeetingReminder, NotificationEventCode.AttendanceRequested,
        NotificationEventCode.MinutesReadyForSignature, NotificationEventCode.MeetingFinalized,
        NotificationEventCode.SubstituteAssigned,
    ];

    // ═══════════════════════════════════════════════════════════
    // رویدادها
    // ═══════════════════════════════════════════════════════════
    public async Task<List<NotificationEventModel>> GetEventsAsync(CancellationToken ct = default)
    {
        var map = NotificationEventMap.Current;
        var eventIds = map.Values.ToList();

        var settings = await db.NotificationSettings.AsNoTracking()
            .Where(s => eventIds.Contains(s.NotificationEventId))
            .ToListAsync(ct);

        var templates = await db.NotificationTemplates.AsNoTracking()
            .Where(t => eventIds.Contains(t.NotificationEventId))
            .Select(t => new { t.Id, t.Title, t.Content, t.NotificationEventId })
            .ToListAsync(ct);

        var since = DateTime.Now.AddDays(-30);
        var stats = await db.NotificationLogs.AsNoTracking()
            .Where(l => l.SentAt >= since && eventIds.Contains(l.NotificationEventId))
            .GroupBy(l => new { l.NotificationEventId, l.Status })
            .Select(g => new { g.Key.NotificationEventId, g.Key.Status, Count = g.Count() })
            .ToListAsync(ct);

        var result = new List<NotificationEventModel>();
        foreach (var def in NotificationEventCatalog.All)
        {
            if (!map.TryGetValue(def.Code, out var eventId)) continue;

            var setting = settings.Where(s => s.NotificationEventId == eventId).OrderByDescending(s => s.Id).FirstOrDefault();
            var eventTemplates = templates.Where(t => t.NotificationEventId == eventId).ToList();

            result.Add(new NotificationEventModel
            {
                Code = def.Code.ToString(),
                CodeValue = (short)def.Code,
                EventId = eventId,
                Title = def.Title,
                Group = MeetingEvents.Contains(def.Code) ? "جلسه" : "مصوبات و پیگیری",
                IsScheduled = def.IsScheduled,
                DefaultRecipients = def.DefaultRecipients.GetFlags().Select(r => r.GetDescription()).ToList(),
                SettingId = setting?.Id,
                IsSmsEnabled = setting?.IsSmsEnabled ?? false,
                IsNotificationEnabled = setting?.IsNotificationEnabled ?? false,
                SendToAllParticipants = setting?.SendToAllParticipants ?? true,
                SupportsAllParticipants = def.DefaultRecipients.HasFlag(NotificationRecipient.AllMembers),
                TemplateId = setting?.NotificationTemplateId,
                TemplateContent = eventTemplates.FirstOrDefault(t => t.Id == setting?.NotificationTemplateId)?.Content,
                DefaultTemplate = def.DefaultTemplate,
                Templates = eventTemplates.Select(t => new NotificationTemplateModel
                {
                    Id = t.Id, Title = t.Title, Content = t.Content, EventCode = def.Code.ToString(),
                    InUse = settings.Any(s => s.NotificationTemplateId == t.Id),
                }).ToList(),
                SentLast30Days = stats.Where(s => s.NotificationEventId == eventId && s.Status == NotificationPublisher.StatusSent).Sum(s => s.Count),
                FailedLast30Days = stats.Where(s => s.NotificationEventId == eventId && s.Status == NotificationPublisher.StatusFailed).Sum(s => s.Count),
            });
        }
        return result;
    }

    public async Task<string?> UpdateEventSettingAsync(UpdateEventSettingModel model, CancellationToken ct = default)
    {
        if (!Enum.TryParse<NotificationEventCode>(model.Code, out var code) || NotificationEventMap.EventIdOf(code) is not { } eventId)
            return "رویداد نامعتبر است.";

        var setting = await db.NotificationSettings
            .Where(s => s.NotificationEventId == eventId)
            .OrderByDescending(s => s.Id)
            .FirstOrDefaultAsync(ct);

        var templateId = model.TemplateId ?? setting?.NotificationTemplateId;
        if (templateId is null || !await db.NotificationTemplates.AnyAsync(t => t.Id == templateId && t.NotificationEventId == eventId, ct))
            return "قالب انتخاب‌شده متعلق به این رویداد نیست.";

        if (setting is null)
        {
            setting = new NotificationSetting { NotificationEventId = eventId };
            db.NotificationSettings.Add(setting);
        }

        setting.IsSmsEnabled = model.IsSmsEnabled;
        setting.IsNotificationEnabled = model.IsNotificationEnabled;
        setting.SendToAllParticipants = model.SendToAllParticipants;
        setting.NotificationTemplateId = templateId.Value;

        await db.SaveChangesAsync(ct);
        return null;
    }

    // ═══════════════════════════════════════════════════════════
    // قالب‌ها
    // ═══════════════════════════════════════════════════════════
    public async Task<(int Id, string? Error)> SaveTemplateAsync(SaveTemplateModel model, CancellationToken ct = default)
    {
        if (!Enum.TryParse<NotificationEventCode>(model.EventCode, out var code) || NotificationEventMap.EventIdOf(code) is not { } eventId)
            return (0, "رویداد نامعتبر است.");
        if (string.IsNullOrWhiteSpace(model.Title)) return (0, "عنوان قالب الزامی است.");
        if (string.IsNullOrWhiteSpace(model.Content)) return (0, "متن قالب الزامی است.");
        if (model.Content.Length > 1000) return (0, "متن قالب حداکثر ۱۰۰۰ کاراکتر است.");

        var unknown = UnknownPlaceholders(model.Content);
        if (unknown.Count > 0) return (0, $"متغیرهای ناشناخته: {string.Join("، ", unknown)}");

        NotificationTemplate template;
        if (model.Id is { } id and > 0)
        {
            template = await db.NotificationTemplates.FirstOrDefaultAsync(t => t.Id == id, ct)
                       ?? throw new InvalidOperationException("قالب یافت نشد.");
            if (template.NotificationEventId != eventId) return (0, "قالب متعلق به رویداد دیگری است.");
        }
        else
        {
            template = new NotificationTemplate { NotificationEventId = eventId };
            db.NotificationTemplates.Add(template);
        }

        template.Title = model.Title.Trim();
        template.Content = model.Content.Trim();
        await db.SaveChangesAsync(ct);

        if (model.SetActive)
        {
            var setting = await db.NotificationSettings.Where(s => s.NotificationEventId == eventId)
                .OrderByDescending(s => s.Id).FirstOrDefaultAsync(ct);
            if (setting is not null)
            {
                setting.NotificationTemplateId = template.Id;
                await db.SaveChangesAsync(ct);
            }
        }

        return (template.Id, null);
    }

    public async Task<string?> DeleteTemplateAsync(int id, CancellationToken ct = default)
    {
        var template = await db.NotificationTemplates.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (template is null) return "قالب یافت نشد.";
        if (await db.NotificationSettings.AnyAsync(s => s.NotificationTemplateId == id, ct))
            return "این قالب در حال استفاده است؛ ابتدا قالب دیگری را برای رویداد انتخاب کنید.";

        db.NotificationTemplates.Remove(template);
        await db.SaveChangesAsync(ct);
        return null;
    }

    public TemplatePreviewResult Preview(TemplatePreviewModel model)
    {
        var sample = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
        {
            ["ReceiverName"] = "آقای احمدی",
            ["MeetingTitle"] = "کمیته فنی پروژه",
            ["MeetingNumber"] = "۱۴۰۵/۱۲۳",
            ["MeetingDate"] = "1405/07/20",
            ["StartTime"] = "10:00",
            ["EndTime"] = "12:00",
            ["Location"] = "سالن جلسات طبقه ۳",
            ["CategoryTitle"] = "جلسات فنی",
            ["ResolutionNumber"] = "05",
            ["ResolutionTitle"] = "تهیه گزارش پیشرفت فیزیکی",
            ["DueDate"] = "1405/08/01",
            ["ActorName"] = "خانم رضایی",
            ["ReferrerName"] = "آقای کریمی",
            ["SystemName"] = SettingValues.SystemName,
            ["Link"] = string.IsNullOrEmpty(SettingValues.SystemBaseUrl) ? "" : SettingValues.SystemBaseUrl + "/#/...",
        };

        var rendered = NotificationTemplateRenderer.Render(model.Content, sample);
        return new TemplatePreviewResult
        {
            Rendered = rendered,
            Length = rendered.Length,
            SmsParts = NotificationTemplateRenderer.SmsParts(rendered),
            UnknownPlaceholders = UnknownPlaceholders(model.Content),
        };
    }

    public static IReadOnlyDictionary<string, string> Placeholders => NotificationEventCatalog.Placeholders;

    private static List<string> UnknownPlaceholders(string content) =>
        System.Text.RegularExpressions.Regex.Matches(content, @"\{([A-Za-z]+)\}")
            .Select(m => m.Groups[1].Value)
            .Where(k => !NotificationEventCatalog.Placeholders.ContainsKey(k))
            .Distinct()
            .ToList();

    // ═══════════════════════════════════════════════════════════
    // لاگ ارسال
    // ═══════════════════════════════════════════════════════════
    public async Task<NotificationLogPage> SearchLogsAsync(NotificationLogSearchModel search, CancellationToken ct = default)
    {
        var page = Math.Max(1, search.Page);
        var size = Math.Clamp(search.PageSize, 5, 200);

        var query = db.NotificationLogs.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search.EventCode)
            && Enum.TryParse<NotificationEventCode>(search.EventCode, out var code)
            && NotificationEventMap.EventIdOf(code) is { } eventId)
            query = query.Where(l => l.NotificationEventId == eventId);

        if (!string.IsNullOrWhiteSpace(search.Receiver))
            query = query.Where(l => l.Receiver.Contains(search.Receiver.Trim()));
        if (search.From is { } from) query = query.Where(l => l.SentAt >= from);
        if (search.To is { } to) query = query.Where(l => l.SentAt < to.Date.AddDays(1));

        var statusCounts = await query.GroupBy(l => l.Status)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToListAsync(ct);

        if (!string.IsNullOrWhiteSpace(search.Status))
        {
            query = search.Status == "retry"
                ? query.Where(l => l.Status.StartsWith(NotificationPublisher.RetryPrefix))
                : query.Where(l => l.Status == search.Status);
        }

        var total = await query.CountAsync(ct);
        var rows = await query.OrderByDescending(l => l.Id)
            .Skip((page - 1) * size).Take(size)
            .Select(l => new { l.Id, l.NotificationEventId, l.Receiver, l.Message, l.Status, l.SentAt, l.ErrorMessage })
            .ToListAsync(ct);

        return new NotificationLogPage
        {
            Total = total,
            StatusCounts = statusCounts
                .GroupBy(s => s.Key.StartsWith(NotificationPublisher.RetryPrefix) ? "retry" : s.Key)
                .ToDictionary(g => g.Key, g => g.Sum(x => x.Count)),
            Items = rows.Select(l =>
            {
                var channel = l.Receiver.StartsWith(NotificationPublisher.SmsPrefix) ? "sms" : "inapp";
                var colon = l.Receiver.IndexOf(':');
                return new NotificationLogModel
                {
                    Id = l.Id,
                    EventTitle = NotificationEventMap.CodeOf(l.NotificationEventId)?.GetDescription() ?? $"رویداد {l.NotificationEventId}",
                    Channel = channel,
                    Receiver = colon >= 0 ? l.Receiver[(colon + 1)..] : l.Receiver,
                    Message = l.Message,
                    Status = l.Status.StartsWith(NotificationPublisher.RetryPrefix) ? "retry" : l.Status,
                    Attempts = Job.NotificationDispatchJob.ParseAttempts(l.Status),
                    SentAt = l.SentAt,
                    ErrorMessage = l.ErrorMessage,
                };
            }).ToList(),
        };
    }

    public async Task<string?> ResendAsync(long id, CancellationToken ct = default)
    {
        var log = await db.NotificationLogs.FirstOrDefaultAsync(l => l.Id == id, ct);
        if (log is null) return "رکورد یافت نشد.";
        if (!log.Receiver.StartsWith(NotificationPublisher.SmsPrefix)) return "فقط پیامک قابل ارسال مجدد است.";

        var mobile = NotificationTemplateRenderer.NormalizeMobile(log.Receiver[NotificationPublisher.SmsPrefix.Length..]);
        if (mobile.Length == 0) return "شماره موبایل گیرنده نامعتبر است.";

        log.Status = NotificationPublisher.StatusPending;
        log.SentAt = DateTime.Now;
        log.ErrorMessage = null;
        await db.SaveChangesAsync(ct);
        return null;
    }

    public async Task<SmsSendResult> SendTestSmsAsync(TestSmsModel model, CancellationToken ct = default)
    {
        var mobile = NotificationTemplateRenderer.NormalizeMobile(model.Mobile);
        if (mobile.Length == 0) return new SmsSendResult(false, "شماره موبایل نامعتبر است.");
        var text = string.IsNullOrWhiteSpace(model.Text) ? $"پیامک آزمایشی {SettingValues.SystemName}" : model.Text.Trim();
        return await smsSender.SendAsync(mobile, text, ct);
    }

    // ═══════════════════════════════════════════════════════════
    // زنگوله اعلان (برای سمت جاری)
    // ═══════════════════════════════════════════════════════════
    public async Task<(List<AlarmModel> Items, int Unread)> GetAlarmsAsync(Guid positionGuid, bool onlyUnread, int take, CancellationToken ct = default)
    {
        var now = DateTime.Now;
        var query = db.AlarmsReceivers.AsNoTracking()
            .Where(r => r.PositionGuid == positionGuid && (r.Alarm.ExpireAt == null || r.Alarm.ExpireAt > now));

        var unread = await query.CountAsync(r => !r.IsRead, ct);
        if (onlyUnread) query = query.Where(r => !r.IsRead);

        var items = await query.OrderByDescending(r => r.Id)
            .Take(Math.Clamp(take, 1, 100))
            .Select(r => new AlarmModel
            {
                Id = r.Id,
                Title = r.Alarm.Title,
                Message = r.Alarm.Message,
                IsRead = r.IsRead,
                ReadAt = r.ReadAt,
                ExpireAt = r.Alarm.ExpireAt,
            })
            .ToListAsync(ct);

        return (items, unread);
    }

    public async Task MarkReadAsync(Guid positionGuid, int? id, CancellationToken ct = default)
    {
        var query = db.AlarmsReceivers.Where(r => r.PositionGuid == positionGuid && !r.IsRead);
        if (id is not null) query = query.Where(r => r.Id == id);

        var now = DateTime.Now;
        foreach (var r in await query.ToListAsync(ct))
        {
            r.IsRead = true;
            r.ReadAt = now;
        }
        await db.SaveChangesAsync(ct);
    }
}
