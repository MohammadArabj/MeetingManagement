using Epc.Domain;

namespace MeetingManagement.Domain.MeetingAgg;

public interface IMeetingRepository : IRepository<long, Meeting>
{
    Task<List<Meeting>> GetMeetingsReadyForAutoClose(DateTime cutoffTime);

}