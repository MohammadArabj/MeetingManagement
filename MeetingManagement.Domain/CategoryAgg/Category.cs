using Epc.Domain;
using MeetingManagement.Domain.CategoryAgg.Service;
using MeetingManagement.Domain.MeetingAgg;

namespace MeetingManagement.Domain.CategoryAgg;

public class Category:AuditableAggregateRootBase<int>
{
    public Category()
    {
        
    }

    public Category(Guid creator,string title,string numberFormat,int startNumber,bool viewAll,bool resetNumberYearly,int step,ICategoryService service):base(creator)
    {
        service.ThrowWhenDuplicated(title).GetAwaiter().GetResult(); // ✅ FIX: قبلاً بدون await اجرا می‌شد → کنترل تکراری کار نمی‌کرد و DbContext هم‌زمان استفاده می‌شد
        Title = title;
        NumberFormat = numberFormat;
        StartNumber = startNumber;
        Step = step;
        ViewAll = viewAll;
        ResetNumberYearly = resetNumberYearly;
    }

    public void Edit(Guid actor, string title,string numberFormat,int startNumber,bool resetNumberYearly,int step, ICategoryService service)
    {
        service.ThrowWhenDuplicated(title,Id).GetAwaiter().GetResult(); // ✅ FIX: قبلاً بدون await اجرا می‌شد → کنترل تکراری کار نمی‌کرد و DbContext هم‌زمان استفاده می‌شد
        Title = title;
        NumberFormat = numberFormat;
        StartNumber = startNumber;
        ResetNumberYearly = resetNumberYearly;
        Step = step;
        Modified(actor);
    }
    public void SetPermission(bool viewAll)
    {
        ViewAll = viewAll;
    }
    public bool ViewAll { get;private set; }
    public bool ResetNumberYearly { get; private set; }
    public string Title { get;private set; }
    public string NumberFormat { get;private set; }
    public int StartNumber { get;private set; }
    public int Step { get;private set; }
    public List<Meeting> Meetings { get; set; } = [];
}