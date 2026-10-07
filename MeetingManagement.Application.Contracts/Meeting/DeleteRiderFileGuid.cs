using System;
using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.Meeting;

public class DeleteRiderFileGuid(Guid guid):ICommand
{
    public Guid Guid { get; set; } = guid;
}