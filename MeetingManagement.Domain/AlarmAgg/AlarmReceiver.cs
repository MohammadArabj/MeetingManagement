using Epc.Domain;

namespace MeetingManagement.Domain.AlarmAgg;

public class AlarmReceiver
{
    public int Id { get; set; }
    public int AlarmId { get; set; }
    public Alarm Alarm { get; set; }

    public Guid PositionGuid { get; set; }      // سمت گیرنده‌ی آلارم
    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }
}