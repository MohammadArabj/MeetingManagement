using System;
using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.Room;

public class ActivateRoomDto(Guid guid) : ICommand
{
    public Guid Guid { get; set; } = guid;
}