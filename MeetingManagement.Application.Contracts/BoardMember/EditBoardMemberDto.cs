using System;

namespace MeetingManagement.Application.Contracts.BoardMember;


public class EditBoardMemberDto:CreateBoardMemberDto
{
    public Guid Guid { get; set; }
}