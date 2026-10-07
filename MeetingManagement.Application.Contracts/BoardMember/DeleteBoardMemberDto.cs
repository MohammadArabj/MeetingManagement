using System;
using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.BoardMember;

public class DeleteBoardMemberDto(Guid guid):ICommand
{
    public Guid Guid { get; } = guid;
}