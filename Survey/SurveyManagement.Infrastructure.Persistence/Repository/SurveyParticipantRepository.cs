using Epc.EntityFramework;
using Microsoft.EntityFrameworkCore;
using SurveyManagement.Domain.ParticipantAgg;
using SurveyManagement.Domain.QuestionAgg;
using System;
using System.Collections.Generic;
using System.Text;

namespace SurveyManagement.Infrastructure.Persistence.Repository
{

    public class SurveyParticipantRepository : BaseRepository<long, SurveyParticipant>, ISurveyParticipantRepository
    {
        private readonly DbContext _context;

        public SurveyParticipantRepository(DbContext commandContext) : base(commandContext)
        {
            _context = commandContext;
        }

        public async Task<bool> ExistsAsync(long surveyId, Guid currentUserId)
        {
            return await _context.Set<SurveyParticipant>()
                .AnyAsync(sp => sp.SurveyId == surveyId && sp.UserGuid == currentUserId);
        }

        public async Task<bool> HasParticipatedAsync(long surveyId, Guid userGuid)
        {
            return await _context.Set<SurveyParticipant>()
                .AnyAsync(sp => sp.SurveyId == surveyId && sp.UserGuid == userGuid);
        }
    }
}
