using Epc.Domain;

namespace SurveyManagement.Domain.ParticipantAgg;


public interface ISurveyParticipantRepository : IRepository<long, SurveyParticipant>
{
    Task<bool> ExistsAsync(long surveyId, Guid currentUserId);
    Task<bool> HasParticipatedAsync(long surveyId, Guid userGuid);
}