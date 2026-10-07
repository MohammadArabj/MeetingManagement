using MeetingManagement.Domain.MeetingAgg;
using MeetingManagement.Domain.RoomAgg.Service;
using Epc.Domain;

namespace MeetingManagement.Domain.RoomAgg;

public class Room:AuditableAggregateRootBase<int>
{
    public Room()
    {
        
    }
    public Room(Guid creator,string title,int capacity,IRoomService service,string? address=null):base(creator)
    {
        service.ThrowWhenDuplicated(title).GetAwaiter().GetResult(); // ✅ FIX: قبلاً بدون await اجرا می‌شد → کنترل تکراری کار نمی‌کرد و DbContext هم‌زمان استفاده می‌شد
        Title = title;
        Address=address;
        Capacity=capacity;
    }

    public void Edit(Guid actor, string title, int capacity, IRoomService service, string? address = null)
    {
        service.ThrowWhenDuplicated(title,Id).GetAwaiter().GetResult(); // ✅ FIX: قبلاً بدون await اجرا می‌شد → کنترل تکراری کار نمی‌کرد و DbContext هم‌زمان استفاده می‌شد
        Title = title;
        Address = address;
        Capacity = capacity;
        Modified(actor);
    }
    public string Title { get;private set; }
    public string? Address { get;private set; }
    public int Capacity { get;private set; }
    public List<Meeting> Meetings { get; set; } = new List<Meeting>();
}