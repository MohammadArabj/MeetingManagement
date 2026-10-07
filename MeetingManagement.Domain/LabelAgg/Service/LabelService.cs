using Epc.Core.Exceptions;
using System.Linq.Expressions;
using Epc.Domain.Specification;

namespace MeetingManagement.Domain.LabelAgg.Service;

public class LabelService(ILabelRepository repository) : ILabelService
{
    private Expression<Func<Label, bool>>? _predicate;
    public async Task ThrowWhenDuplicated(string title, int? id = null)
    {
        _predicate = x => x.Title == title;
        if (id is not null)
            _predicate = _predicate.And(x => x.Id != id);

        if (await repository.ExistsAsync(_predicate))
            throw new DuplicatedDataEnteredException();
    }
    public async Task<bool> HasHistoryAsync(int id)
    {
        _predicate = x => x.Resolutions.Any();
        var result = await repository.ExistsAsync(_predicate);
        return result;
    }
}