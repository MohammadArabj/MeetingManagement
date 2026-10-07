using System;
using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.Meeting;

public class ChangeStatusModel:ICommand
{
    public Guid MeetingGuid { get; set; }
    public int StatusId { get; set; }
}