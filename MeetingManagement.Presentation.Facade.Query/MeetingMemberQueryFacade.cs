using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Infrastructure.Query.Contracts.Member;
using MeetingManagement.Presentation.Facade.Contracts.Member;

namespace MeetingManagement.Presentation.Facade.Query;

public class MeetingMemberQueryFacade(IQueryBusAsync queryBusAsync):IMemberQueryFacade
{

    public async Task<Result<List<MeetingMemberListDto>>> List(MemberSearchDto condition) =>
        await queryBusAsync.Dispatch<Result<List<MeetingMemberListDto>>,MemberSearchDto>(condition);

    public async Task<Result<MeetingMemberSignatureDetailsDto>> GetDetails(MeetingMemberSearchDto condition) =>
        await queryBusAsync.Dispatch<Result<MeetingMemberSignatureDetailsDto>, MeetingMemberSearchDto>(condition);
}