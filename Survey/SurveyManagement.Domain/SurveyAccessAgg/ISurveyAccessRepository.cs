using Epc.Domain;

namespace SurveyManagement.Domain.SurveyAccessAgg;

public interface ISurveyAccessRepository : IRepository<long, SurveyAccess>
{
    Task<List<SurveyAccess>> GetBySurveyIdAsync(long id);
}

public interface ISurveySystemRoleRepository : IRepository<int, SurveySystemRole>
{
}

public interface IUserSurveyRoleRepository : IRepository<long, UserSurveyRole>
{
}
