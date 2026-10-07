using Epc.EntityFramework;
using Microsoft.EntityFrameworkCore;
using SurveyManagement.Domain.QuestionAgg;

namespace SurveyManagement.Infrastructure.Persistence.Repository;

// Question Repository
public class QuestionRepository : BaseRepository<long, Question>, IQuestionRepository
{
    private readonly DbContext _context;

    public QuestionRepository(DbContext commandContext) : base(commandContext)
    {
        _context = commandContext;
    }

    public async Task<List<Question>> GetBySurveyIdAsync(long surveyId)
    {
        return await _context.Set<Question>()
            .Where(q => q.SurveyId == surveyId && !q.IsRemoved)
            .OrderBy(q => q.SortOrder)
            .ToListAsync();
    }
}
