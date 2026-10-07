using Epc.Domain;
using System;
using System.Collections.Generic;
using System.Text;

namespace SurveyManagement.Domain.ResponseAgg
{
    public interface IResponseAnswerRepository : IRepository<long, ResponseAnswer>
    {
        Task<IEnumerable<ResponseAnswer>> GetByQuestionIdAsync(long id);

    }
}
