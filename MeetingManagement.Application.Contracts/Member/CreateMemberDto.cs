using System;
using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.Member;

public class CreateMemberDto : ICommand
{
    public Guid? UserGuid { get; set; }
    public Guid? RoleGuid { get; set; }
    public int? MemberId { get; set; }
    public Guid MeetingGuid { get; set; }
}