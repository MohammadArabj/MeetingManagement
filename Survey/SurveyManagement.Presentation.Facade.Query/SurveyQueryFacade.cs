using Epc.Application.Command;
using Epc.Application.Query;
using Epc.Company.Query;
using SurveyManagement.Infrastructure.Query.Contract.Question;
using SurveyManagement.Infrastructure.Query.Contract.Survey;
using SurveyManagement.Presentation.Facade.Contract.Survey;
using System;

namespace SurveyManagement.Presentation.Facade.Query;

public class SurveyQueryFacade(IQueryBusAsync queryBus) : ISurveyQueryFacade
{
    public async Task<Result<List<SurveyListDto>>> Search(SurveySearchRequest request) =>
        await queryBus.Dispatch<Result<List<SurveyListDto>>, SurveySearchRequest>(request);

    public async Task<Result<SurveyDetailDto>> GetDetail(Guid guid) =>
        await queryBus.Dispatch<Result<SurveyDetailDto>, Guid>(guid);

    public async Task<Result<List<SurveyComboDto>>> GetComboList() =>
        await queryBus.Dispatch<Result<List<SurveyComboDto>>>();

    public async Task<Result<SurveyStatisticsDto>> GetStatistics(GetSurveyStatisticsRequest request) =>
        await queryBus.Dispatch<Result<SurveyStatisticsDto>, GetSurveyStatisticsRequest>(request);

    public async Task<Result<List<SurveyChangeLogDto>>> GetChangeLogs(GetSurveyChangeLogsRequest request) =>
        await queryBus.Dispatch<Result<List<SurveyChangeLogDto>>, GetSurveyChangeLogsRequest>(request);

    public async Task<Result<GetSurveyWithQuestionsResponse>> GetDetailWithQuestions(GetSurveyWithQuestionsRequest request) =>
        await queryBus.Dispatch<Result<GetSurveyWithQuestionsResponse>, GetSurveyWithQuestionsRequest>(request);

    public async Task<Result<PublicSurveyDto>> GetPublicSurvey(GetPublicSurveyRequest request) =>
        await queryBus.Dispatch<Result<PublicSurveyDto>, GetPublicSurveyRequest>(request);


    public async Task<Result<SurveyPublicLinkDto>> GetPublicLink (GetSurveyPublicLinkRequest request) =>
        await queryBus.Dispatch<Result<SurveyPublicLinkDto>, GetSurveyPublicLinkRequest>(request);

    public async Task<Result<List<MySurveyListDto>>> GetMySurveys(GetMySurveysRequest request) =>
        await queryBus.Dispatch<Result<List<MySurveyListDto>>, GetMySurveysRequest>(request);

    public async Task<Result<List<MySurveyListDto>>> GetActiveSurveys(Guid? userGuid) =>
        await queryBus.Dispatch<Result<List<MySurveyListDto>>, Guid?>(userGuid);
}
