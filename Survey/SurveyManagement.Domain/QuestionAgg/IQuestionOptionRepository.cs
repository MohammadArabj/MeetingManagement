using Epc.Domain;
using System;
using System.Collections.Generic;
using System.Text;

namespace SurveyManagement.Domain.QuestionAgg
{
    public interface IQuestionOptionRepository : IRepository<long, QuestionOption>
    {
        Task<List<QuestionOption>> GetByQuestionIdAsync(long id);
    }
}
