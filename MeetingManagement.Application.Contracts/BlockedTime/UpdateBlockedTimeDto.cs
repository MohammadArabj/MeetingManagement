// MeetingManagement.Application.Contracts/BlockedTime/UpdateBlockedTimeDto.cs
using Epc.Application.Command;
using System;

namespace MeetingManagement.Application.Contracts.BlockedTime;
public class UpdateBlockedTimeDto :CreateBlockedTimeDto
{
    public Guid Guid { get; set; }
}

