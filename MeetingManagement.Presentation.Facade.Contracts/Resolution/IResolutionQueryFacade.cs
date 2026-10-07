using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Epc.Company.Query;
using Epc.Core;
using MeetingManagement.Application.Contracts.Assignment;
using MeetingManagement.Infrastructure.Query.Contracts.Resolution;
using Microsoft.AspNetCore.Mvc;

namespace MeetingManagement.Presentation.Facade.Contracts.Resolution;

public interface IResolutionQueryFacade:IFacadeService
{ 
    Task<Result<List<ResolutionJsonModel>>> List(Guid meetingGuid);
    Task<Result<List<ResolutionSearchResultDto>>> Search(ResolutionSearchRequestDto request);
    Task<Result<List<ComboBase>>> GetRelatedResolutions(Guid meetingGuid);
    Task<Result<ResolutionReportDto>> GetDetailReport(ResolutionDetailReportRequestDto request);
    Task<Result<MeetingActionsReportDto>> GetActionsReport(GetActionsReportQuery query);
    Task<Result<int>> GetResolutionNumber(Guid meetingGuid);
    // Task<byte[]> ExportDetailReportToPdf(List<ResolutionDetailReportDto> data, ResolutionDetailReportRequestDto request);
    //Task<byte[]> ExportSummaryReportToPdf(ResolutionSummaryReportDto data, ResolutionSummaryReportRequestDto request);
}