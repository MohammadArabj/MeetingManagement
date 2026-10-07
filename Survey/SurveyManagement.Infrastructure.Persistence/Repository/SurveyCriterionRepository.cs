using Epc.EntityFramework;
using Microsoft.EntityFrameworkCore;
using SurveyManagement.Domain.QuestionAgg;
using SurveyManagement.Domain.SurveyAgg;
using SurveyManagement.Domain.SurveyCriterionAgg;
using System;
using System.Collections.Generic;
using System.Text;
using static Microsoft.AspNetCore.Hosting.Internal.HostingApplication;

namespace SurveyManagement.Infrastructure.Persistence.Repository
{
    public class SurveyCriterionRepository(DbContext commandContext) : BaseRepository<long, SurveyCriterion>(commandContext), ISurveyCriterionRepository
    {
        public async Task<List<SurveyCriterion>> GetBySurveyIdAsync(long id)
        {
            return await commandContext.Set<SurveyCriterion>()
                                      .Where(sc => sc.SurveyId == id)
                                      .ToListAsync();
        }
    }
}
