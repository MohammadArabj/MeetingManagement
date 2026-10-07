using Epc.Domain;
using MeetingManagement.Domain.MeetingAgg;
using MeetingManagement.Domain.RoleAgg.Service;

namespace MeetingManagement.Domain.RoleAgg;

public class Role : AuditableAggregateRootBase<int>
{
    public Role()
    {

    }
    public Role(Guid creator, string title, string color, IRoleService service) : base(creator)
    {
        service.ThrowWhenDuplicated(title).GetAwaiter().GetResult(); // ✅ FIX: قبلاً بدون await اجرا می‌شد → کنترل تکراری کار نمی‌کرد و DbContext هم‌زمان استفاده می‌شد
        Title = title;
        Color = color;
    }


    public void Edit(Guid actor, string title, string color, IRoleService service)
    {
        service.ThrowWhenDuplicated(title, Id).GetAwaiter().GetResult(); // ✅ FIX: قبلاً بدون await اجرا می‌شد → کنترل تکراری کار نمی‌کرد و DbContext هم‌زمان استفاده می‌شد
        Modified(actor);
        Title = title;
        Color = color;
    }
    public string Title { get; set; }
    public string Color { get; set; }
    public string? Description { get; set; }
    public List<MeetingMember> MeetingMembers { get; set; } = [];
}