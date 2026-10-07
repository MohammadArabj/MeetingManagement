using System;
using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.Member;

public class AttendanceMemberDto:ICommand
{
    public long? Id { get; set; }
    public Guid? UserGuid { get; set; }
    public bool IsPresent { get; set; }
}
