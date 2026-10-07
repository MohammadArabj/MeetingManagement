using Epc.EntityFramework;
using Microsoft.EntityFrameworkCore;
using SurveyManagement.Domain.ResponseAgg;
using System.Linq.Expressions;

namespace SurveyManagement.Infrastructure.Persistence.Repository;

// Response Repository
public class ResponseRepository(DbContext commandContext) : BaseRepository<long, Response>(commandContext), IResponseRepository
{
    public async Task<Response?> FindAsync(Expression<Func<Response, bool>> predicate)
    {
        return await commandContext.Set<Response>().FirstOrDefaultAsync(predicate);
    }
}
