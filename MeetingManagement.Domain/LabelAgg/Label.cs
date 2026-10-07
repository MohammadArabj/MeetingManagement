using Epc.Domain;
using MeetingManagement.Domain.LabelAgg.Service;
using MeetingManagement.Domain.ResolutionAgg;

namespace MeetingManagement.Domain.LabelAgg;

public class Label : AuditableAggregateRootBase<int>, IAggregateRoot
{
    public Label()
    {

    }
    public Label(Guid creator, string title, string color, ILabelService labelService):base(creator)
    {
        labelService.ThrowWhenDuplicated(title, Id).GetAwaiter().GetResult(); // ✅ FIX: قبلاً بدون await اجرا می‌شد → کنترل تکراری کار نمی‌کرد و DbContext هم‌زمان استفاده می‌شد
        Title = title;
        Color = color;
    }
    public void Edit(Guid creator,string title, string color, ILabelService labelService)
    {
        labelService.ThrowWhenDuplicated(title, Id).GetAwaiter().GetResult(); // ✅ FIX: قبلاً بدون await اجرا می‌شد → کنترل تکراری کار نمی‌کرد و DbContext هم‌زمان استفاده می‌شد
        Title = title;
        Color = color;
        Modified(creator);
    }   

    public string Title { get; set; }
    public string Color { get; set; }
    public string? Description { get; set; }
    public List<Resolution> Resolutions { get; set; } = [];
}