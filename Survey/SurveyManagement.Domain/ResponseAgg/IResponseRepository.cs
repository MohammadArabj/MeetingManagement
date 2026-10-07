using Epc.Domain;
using System.Linq.Expressions;

namespace SurveyManagement.Domain.ResponseAgg;

public interface IResponseRepository : IRepository<long, Response>
{
    Task<Response?> FindAsync(Expression<Func<Response, bool>> predicate);
}
