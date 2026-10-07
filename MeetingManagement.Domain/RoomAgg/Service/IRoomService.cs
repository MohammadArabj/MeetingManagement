using Epc.Core;

namespace MeetingManagement.Domain.RoomAgg.Service;

public interface IRoomService:IDomainService
{
    Task ThrowWhenDuplicated(string title, int? id = null);

    Task<bool> HasHistoryAsync(int roomId);
}