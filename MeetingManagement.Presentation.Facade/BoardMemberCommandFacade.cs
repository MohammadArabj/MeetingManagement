using System;
using Epc.Application.Command;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.BoardMember;
using MeetingManagement.Presentation.Facade.Contracts.BoardMember;
using System.Threading.Tasks;

namespace MeetingManagement.Presentation.Facade.Command;

public class BoardMemberCommandFacade(IResponsiveCommandBusAsync responsiveCommandBusAsync) : IBoardMemberCommandFacade
{
    public async Task<Result<bool>> Create(CreateBoardMemberDto command) =>
        await responsiveCommandBusAsync.Dispatch<CreateBoardMemberDto, Result<bool>>(command);

    public async Task<Result<bool>> Edit(EditBoardMemberDto command) =>
        await responsiveCommandBusAsync.Dispatch<EditBoardMemberDto, Result<bool>>(command);

    public async Task<Result<bool>> Delete(Guid guid) =>
        await responsiveCommandBusAsync.Dispatch<DeleteBoardMemberDto, Result<bool>>(new DeleteBoardMemberDto(guid));

    public async Task<Result<bool>> Activate(Guid guid) =>
        await responsiveCommandBusAsync.Dispatch<ActivateBoardMemberDto, Result<bool>>(new ActivateBoardMemberDto(guid));

    public async Task<Result<bool>> Deactivate(Guid guid) =>
        await responsiveCommandBusAsync.Dispatch<DeactivateBoardMemberDto, Result<bool>>(new DeactivateBoardMemberDto(guid));
}