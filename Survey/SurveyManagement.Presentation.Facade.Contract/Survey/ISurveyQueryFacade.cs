using Epc.Application.Query;
using Epc.Company.Query;
using SurveyManagement.Infrastructure.Query.Contract.Question;
using SurveyManagement.Infrastructure.Query.Contract.Survey;

namespace SurveyManagement.Presentation.Facade.Contract.Survey;

/// <summary>
/// Facade برای Query های Survey
/// </summary>
public interface ISurveyQueryFacade
{
    Task<Result<List<SurveyListDto>>> Search(SurveySearchRequest request);
    Task<Result<SurveyDetailDto>> GetDetail(Guid guid);
    Task<Result<List<SurveyComboDto>>> GetComboList();
    Task<Result<SurveyStatisticsDto>> GetStatistics(GetSurveyStatisticsRequest request);
    Task<Result<List<SurveyChangeLogDto>>> GetChangeLogs(GetSurveyChangeLogsRequest request);
    Task<Result<GetSurveyWithQuestionsResponse>> GetDetailWithQuestions(GetSurveyWithQuestionsRequest request);
    Task<Result<PublicSurveyDto>> GetPublicSurvey(GetPublicSurveyRequest request);
    Task<Result<SurveyPublicLinkDto>> GetPublicLink (GetSurveyPublicLinkRequest request);
    Task<Result<List<MySurveyListDto>>> GetMySurveys(GetMySurveysRequest request);
    Task<Result<List<MySurveyListDto>>> GetActiveSurveys(Guid? userGuid);
}
