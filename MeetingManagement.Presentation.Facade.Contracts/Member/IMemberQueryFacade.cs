using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Epc.Company.Query;
using Epc.Core;
using MeetingManagement.Infrastructure.Query.Contracts.Member;

namespace MeetingManagement.Presentation.Facade.Contracts.Member;

public interface IMemberQueryFacade:IFacadeService
{
    Task<Result<List<MeetingMemberListDto>>> List(MemberSearchDto condition);
    Task<Result<MeetingMemberSignatureDetailsDto>> GetDetails(MeetingMemberSearchDto condition);
}