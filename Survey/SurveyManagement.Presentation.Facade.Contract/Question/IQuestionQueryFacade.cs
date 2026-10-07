using Epc.Company.Query;
using SurveyManagement.Infrastructure.Query.Contract.Question;

namespace SurveyManagement.Presentation.Facade.Contract.Question;

/// <summary>
/// Facade برای Query های Question
/// </summary>
public interface IQuestionQueryFacade
{
    Task<Result<List<QuestionListDto>>> GetList(GetQuestionListRequest request);
    Task<Result<QuestionDetailDto>> GetDetail(Guid questionGuid);
    Task<Result<List<QuestionDetailDto>>> GetQuestionsForResponse(GetQuestionsForResponseRequest request);
    Task<Result<QuestionStatisticsDto>> GetStatistics(GetQuestionStatisticsRequest request);
}
