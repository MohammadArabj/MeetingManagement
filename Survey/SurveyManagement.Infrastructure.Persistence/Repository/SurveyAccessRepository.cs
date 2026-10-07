using Epc.EntityFramework;
using Microsoft.EntityFrameworkCore;
using SurveyManagement.Domain.SurveyAccessAgg;

namespace SurveyManagement.Infrastructure.Persistence.Repository;

// SurveyAccess Repository
public class SurveyAccessRepository(DbContext commandContext) : BaseRepository<long, SurveyAccess>(commandContext), ISurveyAccessRepository
{
    public async Task<List<SurveyAccess>> GetBySurveyIdAsync(long id)
    {
        return await commandContext.Set<SurveyAccess>().Where(c=>c.SurveyId==id).ToListAsync();
    }
}
