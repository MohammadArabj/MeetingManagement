using System;

namespace MeetingManagement.Application.Contracts.Room;

public class EditRoomDto:CreateRoomDto
{
    public Guid Guid { get; set; }
}