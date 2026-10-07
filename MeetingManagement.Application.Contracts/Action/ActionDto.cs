using System;
using Epc.Application.Command;
using MeetingManagement.Common.Extensions;

namespace MeetingManagement.Application.Contracts.Action;

public class ActionDto:ICommand
{
    public long? Id { get; set; }
    public int AssignmentId { get; set; }
    public string? Description { get; set; }
    public string? ActionDate { get; set; }
    public Guid UserGuid { get; set; }
    public ActionType Type { get; set; }
}