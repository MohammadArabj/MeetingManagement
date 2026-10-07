using Epc.Domain;

namespace MeetingManagement.Domain.ResolutionAgg;

public interface IResolutionRepository : IRepository<long, Resolution>
{
    /// <summary>مصوبه به‌همراه تخصیص‌ها، اقدام‌ها و ارجاع‌های مستقیم (Tracked) برای ویرایش.</summary>
    Task<Resolution?> LoadForEditAsync(long id, CancellationToken ct = default);

    /// <summary>ترتیب‌ها و شماره‌های موجود مصوبات یک جلسه (برای محاسبه بعدی).</summary>
    Task<(List<byte?> SortOrders, List<string?> Numbers)> GetOrderingAsync(long meetingId, long? exceptResolutionId = null, CancellationToken ct = default);

    /// <summary>اجرای چند عملیات در یک تراکنش (اگر تراکنش بیرونی باز باشد، از همان استفاده می‌شود).</summary>
    Task<T> InTransactionAsync<T>(Func<Task<T>> action, CancellationToken ct = default);
}
