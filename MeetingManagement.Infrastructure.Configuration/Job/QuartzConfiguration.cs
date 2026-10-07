using Microsoft.Extensions.DependencyInjection;
using Quartz;

namespace MeetingManagement.Infrastructure.Configuration.Job;

public static class QuartzConfiguration
{
    public static IServiceCollection AddQuartzJobs(this IServiceCollection services)
    {
        services.AddQuartz(q =>
        {
            // ✅ تنظیمات کلی
            // از Quartz 3.7 به بعد Job ها به‌صورت پیش‌فرض با DI و Scope جدا ساخته می‌شوند.

            // ═══════════════════════════════════════════════════════════
            // Job: اتمام خودکار جلسات
            // ═══════════════════════════════════════════════════════════
            var meetingAutoCloseJobKey = new JobKey("MeetingAutoCloseJob");

            q.AddJob<MeetingAutoCloseJob>(opts => opts
                .WithIdentity(meetingAutoCloseJobKey)
                .WithDescription("اتمام خودکار جلسات پس از امضای رئیس و دبیر")
                .StoreDurably());

            // ✅ Trigger: هر شب ساعت 2:00
            q.AddTrigger(opts => opts
                .ForJob(meetingAutoCloseJobKey)
                .WithIdentity("MeetingAutoCloseJob-Trigger")
                .WithCronSchedule("0 0 2 * * ?") // ✅ ساعت 2:00 شب هر روز
                .WithDescription("اجرای روزانه ساعت 2 شب"));

            // ═══════════════════════════════════════════════════════════
            // Job: ارسال صف پیامک (Outbox) — هر دقیقه
            // ═══════════════════════════════════════════════════════════
            var dispatchKey = new JobKey(nameof(NotificationDispatchJob));
            q.AddJob<NotificationDispatchJob>(opts => opts.WithIdentity(dispatchKey).StoreDurably()
                .WithDescription("ارسال پیامک‌های در صف"));
            q.AddTrigger(opts => opts.ForJob(dispatchKey)
                .WithIdentity($"{nameof(NotificationDispatchJob)}-Trigger")
                .StartAt(DateBuilder.FutureDate(30, IntervalUnit.Second))
                .WithSimpleSchedule(s => s.WithIntervalInMinutes(1).RepeatForever()));

            // ═══════════════════════════════════════════════════════════
            // Job: یادآوری‌ها — هر ۱۰ دقیقه
            // ═══════════════════════════════════════════════════════════
            var reminderKey = new JobKey(nameof(NotificationReminderJob));
            q.AddJob<NotificationReminderJob>(opts => opts.WithIdentity(reminderKey).StoreDurably()
                .WithDescription("یادآوری جلسات و سررسید تخصیص‌ها"));
            q.AddTrigger(opts => opts.ForJob(reminderKey)
                .WithIdentity($"{nameof(NotificationReminderJob)}-Trigger")
                .StartAt(DateBuilder.FutureDate(1, IntervalUnit.Minute))
                .WithSimpleSchedule(s => s.WithIntervalInMinutes(10).RepeatForever()));
        });

        // ✅ اجرای Quartz به عنوان Hosted Service
        services.AddQuartzHostedService(options =>
        {
            options.WaitForJobsToComplete = true;
        });

        return services;
    }
}