using MeetingManagement.Domain.Shared.Notifications;
using Microsoft.AspNetCore.Mvc.Filters;

namespace MeetingManagement.Presentation.Api.Realtime;

/// <summary>
/// پس از پایان Action: اگر خطایی رخ نداده باشد (یعنی تراکنش Command با موفقیت Commit شده)،
/// اعلان‌های لحظه‌ای صف‌شده ارسال می‌شوند؛ در غیر این صورت دور ریخته می‌شوند.
/// </summary>
public sealed class RealtimeFlushFilter(IRealtimeNotifier notifier) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var executed = await next();

        if (executed.Exception is null || executed.ExceptionHandled)
            await notifier.FlushAsync(context.HttpContext.RequestAborted);
        else
            notifier.Discard();
    }
}
