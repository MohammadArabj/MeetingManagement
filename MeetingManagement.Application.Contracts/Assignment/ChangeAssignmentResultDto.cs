using Epc.Application.Command;
using MeetingManagement.Common.Extensions;
using System;

namespace MeetingManagement.Application.Contracts.Assignment;

public class ChangeAssignmentResultDto:ICommand
{
    public int Id { get; set; }
    public AssignmentResult Result { get; set; }
    public string Date { get; set; }
    public string? Description { get; set; }
    public Guid PositionGuid { get; set; }
}