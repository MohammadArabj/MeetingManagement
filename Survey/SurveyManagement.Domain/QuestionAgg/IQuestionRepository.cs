using Epc.Domain;

namespace SurveyManagement.Domain.QuestionAgg;

public interface IQuestionRepository : IRepository<long, Question>
{
    Task<List<Question>> GetBySurveyIdAsync(long surveyId);
}