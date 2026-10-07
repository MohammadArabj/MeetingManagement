using Epc.EntityFramework;
using Microsoft.EntityFrameworkCore;
using SurveyManagement.Domain.SurveyAgg;
namespace SurveyManagement.Infrastructure.Persistence.Repository;

// Survey Repository
public class SurveyRepository(DbContext commandContext) : BaseRepository<long, Survey>(commandContext), ISurveyRepository
{
}
