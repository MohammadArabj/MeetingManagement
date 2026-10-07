using Epc.EntityFramework;
using Microsoft.EntityFrameworkCore;
using SurveyManagement.Domain.SurveyAccessAgg;

namespace SurveyManagement.Infrastructure.Persistence.Repository;

// UserSurveyRole Repository
public class UserSurveyRoleRepository(DbContext commandContext) : BaseRepository<long, UserSurveyRole>(commandContext), IUserSurveyRoleRepository
{
}
