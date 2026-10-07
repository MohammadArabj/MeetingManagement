using System;
using Epc.Company.Query;
using Epc.Core;
using MeetingManagement.Application.Contracts.BoardMember;
using System.Threading.Tasks;

namespace MeetingManagement.Presentation.Facade.Contracts.BoardMember;
public interface IBoardMemberCommandFacade:IFacadeService
{
    Task<Result<bool>> Create(CreateBoardMemberDto command);
    Task<Result<bool>> Edit(EditBoardMemberDto command);
    Task<Result<bool>> Delete(Guid guid);
    Task<Result<bool>> Activate(Guid guid);
    Task<Result<bool>> Deactivate(Guid guid);
}