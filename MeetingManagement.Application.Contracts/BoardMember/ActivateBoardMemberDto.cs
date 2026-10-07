using System;
using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.BoardMember;

public class ActivateBoardMemberDto(Guid guid):ICommand
{
    public Guid Guid { get; set; } = guid;
}