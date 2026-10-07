namespace MeetingManagement.Domain.Shared.Access;

/// <summary>مدیریت پیکربندی نقش‌ها (ذخیره در SystemSettings[MeetingRoleConfig]).</summary>
public interface IMeetingRoleConfigService
{
    /// <summary>اگر نقش تعریفی ندارد، با توانایی‌های پیش‌فرض «سفارشی» اضافه شود.</summary>
    Task EnsureDefinitionAsync(int roleId, CancellationToken ct = default);
}
