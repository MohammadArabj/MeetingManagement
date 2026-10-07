using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Epc.Company.Query;
using Epc.Core;
using MeetingManagement.Infrastructure.Query.Contracts.Role;

namespace MeetingManagement.Presentation.Facade.Contracts.Role;

public interface IRoleQueryFacade: IFacadeService
{
    Task<Result<List<RoleListDto>>> List();
    Task<Result<RoleDetailDto>> GetDetails(Guid guid);
    Task<Result<List<RoleComboDto>>> GetForCombo();
}