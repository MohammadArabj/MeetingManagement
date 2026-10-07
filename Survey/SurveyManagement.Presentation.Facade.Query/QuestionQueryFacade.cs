using Epc.Application.Query;
using Epc.Company.Query;
using SurveyManagement.Infrastructure.Query.Contract.Question;
using SurveyManagement.Presentation.Facade.Contract.Question;

namespace SurveyManagement.Presentation.Facade.Query;

public class QuestionQueryFacade : IQuestionQueryFacade
{
    private readonly IQueryBusAsync _queryBus;

    public QuestionQueryFacade(IQueryBusAsync queryBus)
    {
        _queryBus = queryBus;
    }

    public async Task<Result<List<QuestionListDto>>> GetList(GetQuestionListRequest request) =>
        await _queryBus.Dispatch<Result<List<QuestionListDto>>, GetQuestionListRequest>(request);

    public async Task<Result<QuestionDetailDto>> GetDetail(Guid questionGuid) =>
        await _queryBus.Dispatch<Result<QuestionDetailDto>, Guid>(questionGuid);

    public async Task<Result<List<QuestionDetailDto>>> GetQuestionsForResponse(GetQuestionsForResponseRequest request) =>
        await _queryBus.Dispatch<Result<List<QuestionDetailDto>>, GetQuestionsForResponseRequest>(request);

    public async Task<Result<QuestionStatisticsDto>> GetStatistics(GetQuestionStatisticsRequest request) =>
        await _queryBus.Dispatch<Result<QuestionStatisticsDto>, GetQuestionStatisticsRequest>(request);
}
