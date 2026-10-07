using Epc.Domain;
using MeetingManagement.Domain.MeetingAgg;
using MeetingManagement.Domain.MeetingStatusAgg.Service;

namespace MeetingManagement.Domain.MeetingStatusAgg;

public class MeetingStatus : AuditableAggregateRootBase<int>
{
    public MeetingStatus()
    {

    }

    public MeetingStatus(Guid creator, string title,string description, IMeetingStatusService service) : base(creator)
    {
        service.ThrowWhenDuplicated(title).GetAwaiter().GetResult(); // ✅ FIX: قبلاً بدون await اجرا می‌شد → کنترل تکراری کار نمی‌کرد و DbContext هم‌زمان استفاده می‌شد
        Title = title;
        Description = description;
    }

    public void Edit(Guid actor, string title, string description, IMeetingStatusService service)
    {
        service.ThrowWhenDuplicated(title, Id).GetAwaiter().GetResult(); // ✅ FIX: قبلاً بدون await اجرا می‌شد → کنترل تکراری کار نمی‌کرد و DbContext هم‌زمان استفاده می‌شد
        Title = title;
        Description = description;
        Modified(actor);
    }
    public string Title { get; private set; }
    public string? Description { get; private set; }
    public List<Meeting> Meetings { get; set; } = [];
}