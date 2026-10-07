using System;
using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.Meeting;

public class DeleteMeetingDto(Guid guid):ICommand
{
    public Guid Guid { get; set; } = guid;
}