using System;
using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.BoardMember;
using MeetingManagement.Infrastructure.Query.Contracts.BoardMember;
using MeetingManagement.Presentation.Facade.Contracts.BoardMember;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace MeetingManagement.Presentation.Facade.Query;

public class BoardMemberQueryFacade(IQueryBusAsync queryBusAsync) : IBoardMemberQueryFacade
{
    public async Task<Result<List<BoardMemberDto>>> GetList() =>
        await queryBusAsync.Dispatch<Result<List<BoardMemberDto>>>();

    //public async Task<Result<List<BoardMemberComboModel>>> GetActiveList() =>
    //    await queryBusAsync.Dispatch<Result<List<BoardMemberComboModel>>>();

    public async Task<Result<EditBoardMemberDto>> GetForEdit(Guid guid) =>
        await queryBusAsync.Dispatch<Result<EditBoardMemberDto>, Guid>(guid);

    public async Task<Result<List<BoardMemberDto>>> GetByGuids(List<Guid> guids) =>
        await queryBusAsync.Dispatch<Result<List<BoardMemberDto>>, List<Guid>>(guids);

    public async Task<Result<List<BoardMemberListDto>>> GetActiveMembers() =>
        await queryBusAsync.Dispatch<Result<List<BoardMemberListDto>>>();
}

