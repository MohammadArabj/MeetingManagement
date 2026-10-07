using Epc.Core;
using System.Collections.Generic;
using System.Threading.Tasks;
using System;
using Epc.Company.Query;
using MeetingManagement.Infrastructure.Query.Contracts.Status;

namespace MeetingManagement.Presentation.Facade.Contracts.Status;

public interface IStatusQueryFacade:IFacadeService
{
    Task<Result<List<StatusListDto>>> List();
    Task<Result<StatusDetailDto>> GetDetails(Guid guid);
    Task<Result<List<StatusComboDto>>> GetForCombo();
}