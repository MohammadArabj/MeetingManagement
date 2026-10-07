using Epc.EntityFramework;
using Microsoft.EntityFrameworkCore;
using SurveyManagement.Domain.QuestionAgg;
using SurveyManagement.Domain.ResponseAgg;
using System;
using System.Collections.Generic;
using System.Text;

namespace SurveyManagement.Infrastructure.Persistence.Repository
{
    public class ResponseAnswerRepository(DbContext commandContext) : BaseRepository<long, ResponseAnswer>(commandContext), IResponseAnswerRepository
    {
        public async Task<IEnumerable<ResponseAnswer>> GetByQuestionIdAsync(long id)
        {
            return await commandContext.Set<ResponseAnswer>()
                .Where(ra => ra.ResponseId == id)
                .ToListAsync();
        }
    }
}
