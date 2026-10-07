using Epc.Company.Query;
using SurveyManagement.Infrastructure.Query.Contract.Response;
using SurveyManagement.Infrastructure.Query.Contract.SurveyAccess;

namespace SurveyManagement.Presentation.Facade.Contract.Response;

/// <summary>
/// Facade برای Query های Response
/// </summary>
public interface IResponseQueryFacade
{
    Task<Result<List<ResponseListDto>>> Search(ResponseSearchRequest request);
    Task<Result<ResponseDetailDto>> GetDetail(Guid responseGuid);
    Task<Result<ResponseSummaryDto>> GetSummary(GetResponseSummaryRequest request);
    Task<Result<UserDraftResponseDto>> GetUserDraft(GetUserDraftRequest request);
    Task<Result<List<ResponseExportDto>>> ExportResponses(ExportResponsesRequest request);
    Task<Result<UserResponseStatusDto>> GetUserResponseStatus(GetUserResponseStatusRequest request);
    Task<Result<ResponseMatrixDto>> GetMatrix(GetResponseMatrixRequest request);
    Task<Result<SurveyAnalyticsDto>> GetAnalytics(GetSurveyAnalyticsRequest request);
    Task<Result<ParticipantsReportDto>> GetParticipants(GetSurveyParticipantsRequest getSurveyParticipantsRequest);
}
