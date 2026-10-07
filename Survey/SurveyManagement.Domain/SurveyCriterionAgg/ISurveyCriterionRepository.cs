using Epc.Domain;
using SurveyManagement.Domain.SurveyAgg;
using System;
using System.Collections.Generic;
using System.Text;

namespace SurveyManagement.Domain.SurveyCriterionAgg
{
    public interface ISurveyCriterionRepository : IRepository<long, SurveyCriterion>
    {
        Task<List<SurveyCriterion>> GetBySurveyIdAsync(long id);
    }
}
