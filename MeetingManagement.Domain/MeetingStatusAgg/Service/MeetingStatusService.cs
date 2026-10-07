using System.Linq.Expressions;
using Epc.Core.Exceptions;
using Epc.Domain.Specification;

namespace MeetingManagement.Domain.MeetingStatusAgg.Service;

public class MeetingStatusService(IMeetingStatusRepository repository) : IMeetingStatusService
{
    private Expression<Func<MeetingStatus, bool>>? _predicate;

    public async Task ThrowWhenDuplicated(string title, int? id = null)
    {
        _predicate = x => x.Title == title;

        if (id is not null)
            _predicate = _predicate.And(x => x.Id != id);

        if (await repository.ExistsAsync(_predicate))
            throw new DuplicatedDataEnteredException();
    }

}