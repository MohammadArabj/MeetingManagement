using Epc.Core;

namespace MeetingManagement.Domain.MeetingStatusAgg.Service;

public interface IMeetingStatusService : IDomainService
{
    Task ThrowWhenDuplicated(string title, int? id = null);

}