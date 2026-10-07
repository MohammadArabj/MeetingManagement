using Epc.EntityFramework;
using Microsoft.EntityFrameworkCore;
using SurveyManagement.Domain.QuestionAgg;
using System;
using System.Collections.Generic;
using System.Text;

namespace SurveyManagement.Infrastructure.Persistence.Repository
{
    public class QuestionLogicRepository(DbContext commandContext) : BaseRepository<long, QuestionLogic>(commandContext), IQuestionLogicRepository
    {
        public async Task<List<QuestionLogic>> GetByQuestionIdAsync(long id)
        {
            return await commandContext.Set<QuestionLogic>()
                .Where(ql => ql.SourceQuestionId == id)
                .ToListAsync();
        }

        public async Task<IEnumerable<QuestionLogic>> GetByTargetQuestionIdAsync(long questionId)
        {

            return await commandContext.Set<QuestionLogic>()
                .Where(ql => ql.TargetQuestionId == questionId)
                .ToListAsync();
        }
    }
}
