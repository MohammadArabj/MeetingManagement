using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Assignment;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Infrastructure.Query.Contracts.Resolution;
using MeetingManagement.Presentation.Facade.Contracts.Resolution;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
//using MeetingManagement.Infrastructure.Services;

namespace MeetingManagement.Presentation.Facade.Query;

public class ResolutionQueryFacade(IQueryBusAsync queryBusAsync) : IResolutionQueryFacade
{
    public async Task<Result<List<ResolutionJsonModel>>> List(Guid userGuid) =>
        await queryBusAsync.Dispatch<Result<List<ResolutionJsonModel>>, Guid>(userGuid);

    public async Task<Result<List<ResolutionSearchResultDto>>> Search(ResolutionSearchRequestDto request)
        => await queryBusAsync.Dispatch<Result<List<ResolutionSearchResultDto>>, ResolutionSearchRequestDto>(request);

    public async Task<Result<List<ComboBase>>> GetRelatedResolutions(Guid meetingGuid)
        => await queryBusAsync.Dispatch<Result<List<ComboBase>>, Guid>(meetingGuid);

    public async Task<Result<ResolutionReportDto>> GetDetailReport(ResolutionDetailReportRequestDto request)
        => await queryBusAsync.Dispatch<Result<ResolutionReportDto>, ResolutionDetailReportRequestDto>(request);

    public async Task<Result<ResolutionSummaryReportDto>> GetSummaryReport(ResolutionSummaryReportRequestDto request)
        => await queryBusAsync.Dispatch<Result<ResolutionSummaryReportDto>, ResolutionSummaryReportRequestDto>(request);

    public async Task<Result<MeetingActionsReportDto>> GetActionsReport(GetActionsReportQuery query)
        => await queryBusAsync.Dispatch<Result<MeetingActionsReportDto>, GetActionsReportQuery>(query);

    public async Task<Result<int>> GetResolutionNumber(Guid meetingGuid)
        => await queryBusAsync.Dispatch<Result<int>, Guid>(meetingGuid);
}