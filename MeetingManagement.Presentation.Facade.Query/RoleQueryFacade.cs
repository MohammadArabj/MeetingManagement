using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Infrastructure.Query.Contracts.Role;
using MeetingManagement.Presentation.Facade.Contracts.Role;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace MeetingManagement.Presentation.Facade.Query;

public class RoleQueryFacade(IQueryBusAsync queryBusAsync):IRoleQueryFacade
{
    public async Task<Result<List<RoleListDto>>> List()=>await queryBusAsync.Dispatch<Result<List<RoleListDto>>>(); 
    public async Task<Result<RoleDetailDto>> GetDetails(Guid guid)=> await queryBusAsync.Dispatch<Result<RoleDetailDto>,Guid>(guid);
    public async Task<Result<List<RoleComboDto>>> GetForCombo() => await queryBusAsync.Dispatch<Result<List<RoleComboDto>>>();  
}