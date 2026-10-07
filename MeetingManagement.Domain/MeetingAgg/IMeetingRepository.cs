using Epc.Domain;

namespace MeetingManagement.Domain.MeetingAgg;

public interface IMeetingRepository : IRepository<long, Meeting>
{
    Task<List<Meeting>> GetMeetingsReadyForAutoClose(DateTime cutoffTime);

    /// <summary>جلسات «ثبت اولیه/برگزار شده» با تاریخ پیش از <paramref name="dateBefore"/></summary>
    Task<List<Meeting>> GetStaleOpenMeetings(DateTime dateBefore);

}