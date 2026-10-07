using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.AlarmAgg;
using MeetingManagement.Domain.NotificationLogAgg;
using MeetingManagement.Domain.SettingAgg;
using MeetingManagement.Domain.Shared.Access;
using MeetingManagement.Domain.Shared.Acls.UserManagement;
using MeetingManagement.Domain.Shared.Notifications;
using MeetingManagement.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace MeetingManagement.Infrastructure.Configuration.Notifications;

/// <summary>
/// تبدیل یک رویداد به پیام‌های قابل ارسال.
/// ─────────────────────────────────────────────────────────────────────────
///   ۱) تنظیمات رویداد (NotificationSettings) و قالب آن خوانده می‌شود
///   ۲) گیرندگان بر اساس نقش‌ها/گیرندگان صریح محاسبه می‌شوند (بدون تکرار، بدون خودِ ایجادکننده)
///   ۳) پیامک‌ها با وضعیت pending در NotificationLogs ثبت می‌شوند (Outbox) — Job آن‌ها را می‌فرستد
///   ۴) اعلان داخل سامانه مستقیماً در Alarms/AlarmsReceivers ثبت می‌شود
/// همه‌ی نوشتن‌ها روی همان DbContext درخواست انجام می‌شود؛ پس با Commit عملیات اصلی ذخیره می‌شوند
/// و اگر عملیات اصلی Rollback شود، پیامی هم ارسال نمی‌شود.
/// </summary>
public sealed class NotificationPublisher(
    MeetingManagementCommandContext db,
    IUserManagementAclService aclService,
    ILogger<NotificationPublisher> logger) : INotificationPublisher
{
    public const string StatusPending = "pending";
    public const string StatusSent = "sent";
    public const string StatusFailed = "failed";
    public const string StatusSkipped = "skipped";
    public const string RetryPrefix = "retry:";
    public const string SmsPrefix = "sms:";
    public const string InAppPrefix = "inapp:";

    public async Task PublishAsync(NotificationEventCode code, NotificationPayload payload, CancellationToken ct = default)
    {
        var eventId = NotificationEventMap.EventIdOf(code);
        if (eventId is null)
        {
            logger.LogDebug("Notification event {Code} is not mapped; skipped.", code);
            return;
        }

        var setting = await db.NotificationSettings.AsNoTracking()
            .Include(s => s.Template)
            .Where(s => s.NotificationEventId == eventId)
            .OrderByDescending(s => s.Id)
            .FirstOrDefaultAsync(ct);

        if (setting is null) return;

        var sendSms = setting.IsSmsEnabled && SettingValues.SmsEnabled;
        var sendInApp = setting.IsNotificationEnabled && SettingValues.InAppNotificationEnabled;
        if (!sendSms && !sendInApp) return;

        var definition = NotificationEventCatalog.Get(code);
        var template = string.IsNullOrWhiteSpace(setting.Template?.Content) ? definition.DefaultTemplate : setting.Template!.Content;

        var recipientsFlags = definition.DefaultRecipients;
        if (!setting.SendToAllParticipants && recipientsFlags.HasFlag(NotificationRecipient.AllMembers))
            recipientsFlags = (recipientsFlags & ~NotificationRecipient.AllMembers) | NotificationRecipient.Chairman | NotificationRecipient.Secretary;

        var values = new Dictionary<string, string?>(payload.Values, StringComparer.OrdinalIgnoreCase)
        {
            ["SystemName"] = SettingValues.SystemName,
        };

        var recipients = new List<Recipient>();

        if (payload.MeetingId is { } meetingId)
            await AddMeetingContextAsync(meetingId, recipientsFlags, values, recipients, ct);

        if (payload.ResolutionId is { } resolutionId)
            await AddResolutionContextAsync(resolutionId, values, ct);

        foreach (var t in payload.Targets.Where(t => recipientsFlags.HasFlag(t.As) || t.As == NotificationRecipient.None))
            recipients.Add(new Recipient(t.UserGuid, t.PositionGuid, t.Mobile, t.Name));

        if (payload.ActorUserGuid is { } self)
            recipients.RemoveAll(r => r.UserGuid == self);

        recipients = Deduplicate(recipients);
        if (recipients.Count == 0) return;

        await EnrichFromUserManagementAsync(recipients, values, ct);

        var now = DateTime.Now;
        var smsSendAt = SettingValues.IsInQuietHours(now) ? NextAllowedTime(now) : now;

        foreach (var r in recipients)
        {
            var personal = new Dictionary<string, string?>(values, StringComparer.OrdinalIgnoreCase)
            {
                ["ReceiverName"] = r.Name ?? "همکار",
            };
            var message = NotificationTemplateRenderer.Render(template, personal);

            if (sendSms)
            {
                var mobile = NotificationTemplateRenderer.NormalizeMobile(r.Mobile);
                db.NotificationLogs.Add(new NotificationLog
                {
                    NotificationEventId = eventId.Value,
                    Receiver = $"{SmsPrefix}{(mobile.Length > 0 ? mobile : r.UserGuid?.ToString() ?? "-")}",
                    Message = Truncate(message, 4000),
                    SentAt = smsSendAt,
                    Status = mobile.Length > 0 ? StatusPending : StatusSkipped,
                    ErrorMessage = mobile.Length > 0 ? null : "شماره موبایل معتبر برای گیرنده ثبت نشده است.",
                });
            }

            if (sendInApp && r.PositionGuid is { } position && position != Guid.Empty)
            {
                // ⚠️ در اسکیمای فعلی کلید AlarmsReceivers.Id همان FK به Alarms.Id است؛
                // بنابراین هر هشدار دقیقاً یک گیرنده دارد (بدون تغییر اسکیما).
                var alarm = new Alarm
                {
                    Title = Truncate(definition.Title, 200),
                    Message = Truncate(message, 1000),
                    ExpireAt = now.AddDays(30),
                };
                alarm.Receivers.Add(new AlarmReceiver { PositionGuid = position, IsRead = false });
                db.Alarms.Add(alarm);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Context builders
    // ═══════════════════════════════════════════════════════════
    private async Task AddMeetingContextAsync(long meetingId, NotificationRecipient flags,
        Dictionary<string, string?> values, List<Recipient> recipients, CancellationToken ct)
    {
        var meeting = await db.Meetings.AsNoTracking()
            .Where(m => m.Id == meetingId)
            .Select(m => new
            {
                m.Guid, m.Title, m.Number, m.Date, m.StartTime, m.EndTime, m.RoomLink, m.RoomName, m.CreatedBy,
                RoomTitle = m.Room != null ? m.Room.Title : null,
                CategoryTitle = m.Category != null ? m.Category.Title : null,
                Members = m.MeetingMembers.Select(mm => new
                {
                    mm.RoleId, mm.UserGuid, mm.PositionGuid, mm.Name, mm.ReplacementUserGuid,
                    // اعضای هیئت مدیره موبایل را در جدول BoardMembers دارند
                    Mobile = mm.Mobile ?? (mm.BoardMember != null ? mm.BoardMember.Mobile : null),
                    BoardName = mm.BoardMember != null ? mm.BoardMember.FirstName + " " + mm.BoardMember.LastName : null,
                }).ToList(),
            })
            .FirstOrDefaultAsync(ct);

        if (meeting is null) return;

        values.TryAdd("MeetingTitle", meeting.Title);
        values.TryAdd("MeetingNumber", meeting.Number);
        values.TryAdd("MeetingDate", meeting.Date is { } d ? ToShamsi(d) : null);
        values.TryAdd("StartTime", meeting.StartTime?.ToString(@"hh\:mm"));
        values.TryAdd("EndTime", meeting.EndTime?.ToString(@"hh\:mm"));
        values.TryAdd("Location", meeting.RoomLink ?? meeting.RoomName ?? meeting.RoomTitle);
        values.TryAdd("CategoryTitle", meeting.CategoryTitle);
        values.TryAdd("Link", BuildLink($"/#/meetings/details/{meeting.Guid}"));

        foreach (var m in meeting.Members)
        {
            var role = MeetingRoles.Get(m.RoleId);
            if (role is not null && !role.Has(MeetingCapability.ReceiveNotifications)) continue;

            var include =
                flags.HasFlag(NotificationRecipient.AllMembers)
                || (flags.HasFlag(NotificationRecipient.Chairman) && MeetingRoles.Is(m.RoleId, MeetingRoleKey.Chairman))
                || (flags.HasFlag(NotificationRecipient.Secretary) && MeetingRoles.IsAnySecretary(m.RoleId))
                || (flags.HasFlag(NotificationRecipient.Guests) && MeetingRoles.Is(m.RoleId, MeetingRoleKey.Guest))
                || (flags.HasFlag(NotificationRecipient.Observers) && MeetingRoles.Is(m.RoleId, MeetingRoleKey.Observer));

            if (include)
                recipients.Add(new Recipient(m.UserGuid, m.PositionGuid, m.Mobile, m.Name ?? m.BoardName));

            if (flags.HasFlag(NotificationRecipient.Substitute) && m.ReplacementUserGuid is { } sub)
                recipients.Add(new Recipient(sub, null, null, null));
        }

        if (flags.HasFlag(NotificationRecipient.Creator) && meeting.CreatedBy is { } creator)
            recipients.Add(new Recipient(creator, null, null, null));
    }

    private async Task AddResolutionContextAsync(long resolutionId, Dictionary<string, string?> values, CancellationToken ct)
    {
        var resolution = await db.Resolutions.AsNoTracking()
            .Where(r => r.Id == resolutionId)
            .Select(r => new { r.Number, r.SortOrder, r.Title, r.Text })
            .FirstOrDefaultAsync(ct);
        if (resolution is null) return;

        values.TryAdd("ResolutionNumber", resolution.Number ?? resolution.SortOrder?.ToString());
        var title = resolution.Title ?? resolution.Text ?? string.Empty;
        values.TryAdd("ResolutionTitle", title.Length > 60 ? title[..60] + "…" : title);
        if (!values.TryGetValue("Link", out var link) || string.IsNullOrEmpty(link))
            values["Link"] = BuildLink("/#/resolutions/list");
    }

    private async Task EnrichFromUserManagementAsync(List<Recipient> recipients, Dictionary<string, string?> values, CancellationToken ct)
    {
        var extraGuids = new List<Guid?>();
        if (Guid.TryParse(values.GetValueOrDefault("ActorUserGuid"), out var actor)) extraGuids.Add(actor);
        if (Guid.TryParse(values.GetValueOrDefault("ReferrerUserGuid"), out var referrer)) extraGuids.Add(referrer);

        var needed = recipients
            .Where(r => r.UserGuid is not null && (string.IsNullOrEmpty(r.Mobile) || string.IsNullOrEmpty(r.Name)))
            .Select(r => r.UserGuid)
            .Concat(extraGuids)
            .Distinct()
            .ToList();

        if (needed.Count == 0) return;

        try
        {
            var users = (await aclService.GetUsersByGuidsAsync(needed)).ToDictionary(u => u.Guid);

            for (var i = 0; i < recipients.Count; i++)
            {
                var r = recipients[i];
                if (r.UserGuid is { } g && users.TryGetValue(g, out var u))
                    recipients[i] = r with
                    {
                        Mobile = string.IsNullOrEmpty(r.Mobile) ? u.Mobile : r.Mobile,
                        Name = string.IsNullOrEmpty(r.Name) ? u.Fullname : r.Name,
                    };
            }

            if (users.TryGetValue(actor, out var a)) values.TryAdd("ActorName", a.Fullname);
            if (users.TryGetValue(referrer, out var rf)) values.TryAdd("ReferrerName", rf.Fullname);
        }
        catch (Exception ex)
        {
            // در نبود UserManagement پیام‌ها بدون موبایل ثبت می‌شوند (وضعیت skipped) تا قابل پیگیری باشند
            logger.LogWarning(ex, "Could not load recipients from UserManagement");
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════
    private sealed record Recipient(Guid? UserGuid, Guid? PositionGuid, string? Mobile, string? Name);

    private static List<Recipient> Deduplicate(List<Recipient> list)
    {
        var result = new List<Recipient>();
        foreach (var r in list)
        {
            var existing = result.FindIndex(x =>
                (r.UserGuid is not null && x.UserGuid == r.UserGuid)
                || (r.UserGuid is null && !string.IsNullOrEmpty(r.Mobile) && x.Mobile == r.Mobile));

            if (existing < 0) result.Add(r);
            else
            {
                var x = result[existing];
                result[existing] = x with
                {
                    PositionGuid = x.PositionGuid ?? r.PositionGuid,
                    Mobile = string.IsNullOrEmpty(x.Mobile) ? r.Mobile : x.Mobile,
                    Name = string.IsNullOrEmpty(x.Name) ? r.Name : x.Name,
                };
            }
        }
        return result.Where(r => r.UserGuid is not null || !string.IsNullOrEmpty(r.Mobile)).ToList();
    }

    private static DateTime NextAllowedTime(DateTime now)
    {
        var end = SettingValues.NotificationQuietEnd ?? TimeSpan.Zero;
        var candidate = now.Date.Add(end);
        return candidate > now ? candidate : candidate.AddDays(1);
    }

    private static string? BuildLink(string path) =>
        string.IsNullOrWhiteSpace(SettingValues.SystemBaseUrl) ? null : SettingValues.SystemBaseUrl + path;

    public static string ToShamsi(DateTime date)
    {
        var pc = new PersianCalendar();
        return $"{pc.GetYear(date):0000}/{pc.GetMonth(date):00}/{pc.GetDayOfMonth(date):00}";
    }

    private static string Truncate(string s, int max) => s.Length <= max ? s : s[..max];
}
