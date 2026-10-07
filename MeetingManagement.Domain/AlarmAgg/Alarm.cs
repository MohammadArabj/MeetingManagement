using Epc.Domain;

namespace MeetingManagement.Domain.AlarmAgg;

public class Alarm:EntityBase<int>
{
    public string Title { get; set; }              // عنوان آلارم
    public string Message { get; set; }            // متن نهایی با پارامترهای جایگزین‌شده
    public DateTime? ExpireAt { get; set; }

    public List<AlarmReceiver> Receivers { get; set; } = [];
}