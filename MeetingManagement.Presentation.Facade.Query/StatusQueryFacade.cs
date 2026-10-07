using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Infrastructure.Query.Contracts.Status;
using MeetingManagement.Presentation.Facade.Contracts.Status;

namespace MeetingManagement.Presentation.Facade.Query;

public class StatusQueryFacade(IQueryBusAsync queryBusAsync):IStatusQueryFacade
{
    public async Task<Result<List<StatusListDto>>> List() => await queryBusAsync.Dispatch<Result<List<StatusListDto>>>();
    public async Task<Result<StatusDetailDto>> GetDetails(Guid guid) => await queryBusAsync.Dispatch<Result<StatusDetailDto>, Guid>(guid);
    public async Task<Result<List<StatusComboDto>>> GetForCombo() => await queryBusAsync.Dispatch<Result<List<StatusComboDto>>>();
}