using Epc.Company.Query;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.Shared.Access;

namespace MeetingManagement.Application.Services;

/// <summary>
/// کنترل یکسان دسترسی در Command Handlerها.
/// <code>
/// var check = await MeetingGuard.CheckAsync(accessService, meetingId, MeetingCapability.ManageAgenda);
/// if (!check.Allowed) return Result&lt;bool&gt;.Failure(false, check.Error!);
/// </code>
/// </summary>
public static class MeetingGuard
{
    public const string ClosedMessage = "جلسه بسته شده (لغو یا اتمام یافته) و قابل تغییر نیست.";

    public readonly record struct Check(MeetingAccess Access, string? Error)
    {
        public bool Allowed => Error is null;
    }

    /// <param name="requireOpen">اگر true باشد، تغییر در جلسه‌ی لغوشده یا اتمام‌یافته رد می‌شود.</param>
    public static async Task<Check> CheckAsync(IMeetingAccessService service, long meetingId,
        MeetingCapability capability, bool requireOpen = true)
        => Evaluate(await service.GetAsync(meetingId), capability, requireOpen);

    public static async Task<Check> CheckAsync(IMeetingAccessService service, Guid meetingGuid,
        MeetingCapability capability, bool requireOpen = true)
        => Evaluate(await service.GetAsync(meetingGuid), capability, requireOpen);

    private static Check Evaluate(MeetingAccess access, MeetingCapability capability, bool requireOpen)
    {
        if (!access.Exists)
            return new Check(access, "جلسه مورد نظر یافت نشد.");
        if (!access.Can(capability))
            return new Check(access, MeetingAccess.DeniedMessage(capability));
        if (requireOpen && MeetingStatusIds.Closed.Contains(access.StatusId))
            return new Check(access, ClosedMessage);
        return new Check(access, null);
    }

    public static Result<T> Fail<T>(this Check check, T value = default!) => Result<T>.Failure(value, check.Error!);
}
