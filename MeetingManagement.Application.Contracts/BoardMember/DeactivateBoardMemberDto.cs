using System;
using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.BoardMember;

public class DeactivateBoardMemberDto(Guid guid):ICommand
{
    public Guid Guid { get; set; } = guid;
}