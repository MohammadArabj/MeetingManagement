using Epc.EntityFramework;
using Microsoft.EntityFrameworkCore;
using SurveyManagement.Domain.QuestionAgg;
using System;
using System.Collections.Generic;
using System.Text;

namespace SurveyManagement.Infrastructure.Persistence.Repository
{
    public class QuestionOptionRepository(DbContext commandContext) : BaseRepository<long, QuestionOption>(commandContext), IQuestionOptionRepository
    {
        public Task<List<QuestionOption>> GetByQuestionIdAsync(long id)
        {
            return commandContext.Set<QuestionOption>()
                .Where(qo => qo.QuestionId == id)
                .ToListAsync();
        }
    }
}
