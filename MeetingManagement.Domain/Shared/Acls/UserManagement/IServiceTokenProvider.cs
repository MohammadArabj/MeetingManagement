namespace MeetingManagement.Domain.Shared.Acls.UserManagement;

/// <summary>
/// توکن «سرویس به سرویس» (client_credentials) برای فراخوانی UserManagement در کارهای پس‌زمینه
/// (Job های اطلاع‌رسانی) که HttpContext و توکن کاربر ندارند.
/// </summary>
public interface IServiceTokenProvider
{
    /// <summary>مقدار هدر Authorization (مثلاً "Bearer eyJ...") یا null اگر پیکربندی نشده باشد.</summary>
    Task<string?> GetAuthorizationHeaderAsync(CancellationToken ct = default);
}
