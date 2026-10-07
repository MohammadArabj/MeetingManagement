using Epc.EntityFramework;
using Microsoft.EntityFrameworkCore;
using SurveyManagement.Domain.SurveyAccessAgg;
namespace SurveyManagement.Infrastructure.Persistence.Repository;

// SurveySystemRole Repository
public class SurveySystemRoleRepository : BaseRepository<int, SurveySystemRole>, ISurveySystemRoleRepository
{
    public SurveySystemRoleRepository(DbContext commandContext) : base(commandContext)
    {
    }
}
