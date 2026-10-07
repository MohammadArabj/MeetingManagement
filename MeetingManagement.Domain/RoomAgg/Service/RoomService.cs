using Epc.Core.Exceptions;
using Epc.Domain.Specification;
using System.Linq.Expressions;

namespace MeetingManagement.Domain.RoomAgg.Service;

public class RoomService(IRoomRepository repository) : IRoomService
{
    private Expression<Func<Room, bool>>? _predicate;

    public async Task ThrowWhenDuplicated(string title, int? id = null)
    {
        _predicate = x => x.Title == title;
        if (id is not null)
            _predicate = _predicate.And(x => x.Id != id);

        if (await repository.ExistsAsync(_predicate))
            throw new DuplicatedDataEnteredException();
    }

    public async Task<bool> HasHistoryAsync(int roomId)
    {
        _predicate = x => x.Id == roomId;
        _predicate = _predicate.And(x => x.Meetings.Any());
        var result = await repository.ExistsAsync(_predicate);
        return result;
    }
}