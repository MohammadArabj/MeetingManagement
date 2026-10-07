using Microsoft.EntityFrameworkCore;
using SurveyManagement.Infrastructure.Persistence;
using SurveyManagement.Infrastructure.Persistence.Views;

namespace SurveyManagement.Infrastructure.Query;

public interface IPersonelInfoQueryService
{
    Task<PersonelInfoView?> GetByPersonnelCodeAsync(string personnelCode);
}

public class PersonelInfoQueryService(SurveyManagementQueryContext context) : IPersonelInfoQueryService
{
    public async Task<PersonelInfoView?> GetByPersonnelCodeAsync(string personnelCode)
    {
        return await context.PersonelInfoViews
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.PersonelNo == personnelCode);
    }
}