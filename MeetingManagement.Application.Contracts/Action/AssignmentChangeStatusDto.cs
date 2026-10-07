using MeetingManagement.Common.Security;
using Epc.Application.Command;
using System;

namespace MeetingManagement.Application.Contracts.Action;

public class AssignmentChangeStatusDto:ICommand
{
    public int Id { get; set; }
    [CallerPosition]
    public Guid PositionGuid { get; set; }
    public bool IsFollower { get; set; }
}