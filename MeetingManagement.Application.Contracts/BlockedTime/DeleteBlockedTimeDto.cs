using Epc.Application.Command;
using System;

namespace MeetingManagement.Application.Contracts.BlockedTime;

public class DeleteBlockedTimeDto(Guid guid) : ICommand
{
    public Guid Guid { get; set; } = guid;
}
