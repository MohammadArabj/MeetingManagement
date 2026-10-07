using Epc.Core;

namespace MeetingManagement.Domain.CategoryAgg.Service;

public interface ICategoryService:IDomainService
{
    Task ThrowWhenDuplicated(string title, int? id = null);
    Task<bool> HasHistoryAsync(int id);
}