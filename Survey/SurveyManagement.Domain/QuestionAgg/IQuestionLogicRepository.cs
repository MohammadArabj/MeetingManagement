using Epc.Domain;
using System;
using System.Collections.Generic;
using System.Text;

namespace SurveyManagement.Domain.QuestionAgg
{
    public interface IQuestionLogicRepository : IRepository<long, QuestionLogic>
    {
        Task<List<QuestionLogic>> GetByQuestionIdAsync(long id);
        Task<IEnumerable<QuestionLogic>> GetByTargetQuestionIdAsync(long questionId);
    }
}
