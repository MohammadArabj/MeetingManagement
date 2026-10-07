using Epc.Application.Query;
using Epc.Company.Query;
using SurveyManagement.Infrastructure.Query.Contract.Response;
using SurveyManagement.Infrastructure.Query.Contract.SurveyAccess;
using SurveyManagement.Presentation.Facade.Contract.Response;

namespace SurveyManagement.Presentation.Facade.Query;

public class ResponseQueryFacade : IResponseQueryFacade
{
    private readonly IQueryBusAsync _queryBus;

    public ResponseQueryFacade(IQueryBusAsync queryBus)
    {
        _queryBus = queryBus;
    }

    public async Task<Result<List<ResponseListDto>>> Search(ResponseSearchRequest request) =>
        await _queryBus.Dispatch<Result<List<ResponseListDto>>, ResponseSearchRequest>(request);

    public async Task<Result<ResponseDetailDto>> GetDetail(Guid responseGuid) =>
        await _queryBus.Dispatch<Result<ResponseDetailDto>, Guid>(responseGuid);

    public async Task<Result<ResponseSummaryDto>> GetSummary(GetResponseSummaryRequest request) =>
        await _queryBus.Dispatch<Result<ResponseSummaryDto>, GetResponseSummaryRequest>(request);

    public async Task<Result<UserDraftResponseDto>> GetUserDraft(GetUserDraftRequest request) =>
        await _queryBus.Dispatch<Result<UserDraftResponseDto>, GetUserDraftRequest>(request);

    public async Task<Result<List<ResponseExportDto>>> ExportResponses(ExportResponsesRequest request) =>
        await _queryBus.Dispatch<Result<List<ResponseExportDto>>, ExportResponsesRequest>(request);
    public async Task<Result<UserResponseStatusDto>> GetUserResponseStatus(GetUserResponseStatusRequest request)
    => await _queryBus.Dispatch<Result<UserResponseStatusDto>, GetUserResponseStatusRequest>(request);

    public async Task<Result<ResponseMatrixDto>> GetMatrix(GetResponseMatrixRequest request) =>
        await _queryBus.Dispatch<Result<ResponseMatrixDto>, GetResponseMatrixRequest>(request);

    public async Task<Result<SurveyAnalyticsDto>> GetAnalytics(GetSurveyAnalyticsRequest request) =>
        await _queryBus.Dispatch<Result<SurveyAnalyticsDto>, GetSurveyAnalyticsRequest>(request);

    public async Task<Result<ParticipantsReportDto>> GetParticipants(GetSurveyParticipantsRequest getSurveyParticipantsRequest)=>
        await _queryBus.Dispatch<Result<ParticipantsReportDto>, GetSurveyParticipantsRequest>(getSurveyParticipantsRequest);
}
