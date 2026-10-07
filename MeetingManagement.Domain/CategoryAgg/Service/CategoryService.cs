using Epc.Core.Exceptions;
using Epc.Domain.Specification;
using System.Linq.Expressions;

namespace MeetingManagement.Domain.CategoryAgg.Service;

public class CategoryService(ICategoryRepository repository) : ICategoryService
{
    private Expression<Func<Category, bool>>? _predicate;

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
        _predicate = x => x.Meetings.Any(x=>x.CategoryId==id);
        var result = await repository.ExistsAsync(_predicate);
        return result;
    }
}