using System;
using Epc.Company.Query;
using Epc.Core;
using MeetingManagement.Application.Contracts.BoardMember;
using MeetingManagement.Infrastructure.Query.Contracts.BoardMember;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace MeetingManagement.Presentation.Facade.Contracts.BoardMember;

public interface IBoardMemberQueryFacade : IFacadeService
{
    Task<Result<List<BoardMemberDto>>> GetList();
    //Task<Result<List<BoardMemberComboModel>>> GetActiveList();
    Task<Result<EditBoardMemberDto>> GetForEdit(Guid guid);
    Task<Result<List<BoardMemberDto>>> GetByGuids(List<Guid> guids);
    Task<Result<List<BoardMemberListDto>>> GetActiveMembers();
}