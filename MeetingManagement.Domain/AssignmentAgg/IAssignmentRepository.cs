using Epc.Domain;

namespace MeetingManagement.Domain.AssignmentAgg;

public interface IAssignmentRepository : IRepository<int, Assignment>
{
    /// <summary>
    /// همه‌ی تخصیص‌های یک مصوبه (اصلی و ارجاع‌ها) به‌همراه اقدام‌ها، به‌صورت Tracked.
    /// برای پیمایش درخت ارجاع در حافظه (تشخیص چرخه، عمق، بستن آبشاری).
    /// </summary>
    Task<List<Assignment>> GetResolutionTreeAsync(long resolutionId, CancellationToken ct = default);

    /// <summary>یک تخصیص با اقدام‌ها و ارجاع‌های مستقیمش (Tracked).</summary>
    Task<Assignment?> LoadWithChildrenAsync(int id, CancellationToken ct = default);

    /// <summary>تخصیص‌های اصلی (غیر ارجاع) همه‌ی مصوبات یک جلسه — برای اطلاع‌رسانی هنگام ابلاغ.</summary>
    Task<List<Assignment>> GetOriginalsByMeetingAsync(long meetingId, CancellationToken ct = default);
}
