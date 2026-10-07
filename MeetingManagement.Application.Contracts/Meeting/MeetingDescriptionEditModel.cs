using System;
using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.Meeting;

public class MeetingDescriptionEditModel:ICommand
{
    public Guid Guid { get; set; }
    public string? Description { get; set; }
}