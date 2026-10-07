using Epc.Application.Command;
using System;

namespace MeetingManagement.Application.Contracts.Member;

public class AttendanceGroupDto:ICommand
{
    public Guid MeetingGuid { get; set; }
    public bool IsPresent { get; set; }
}