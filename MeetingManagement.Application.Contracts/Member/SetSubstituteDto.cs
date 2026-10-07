using System;
using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.Member;

public class SetSubstituteDto:ICommand
{
    public long? Id { get; set; }
    public Guid? UserGuid { get; set; }
    public bool IsAttendance { get; set; }
    public Guid? ReplacementUserGuid { get; set; }
    public Guid? ReplacementPositionGuid { get; set; }
    public string? PersNo { get; set; }
}