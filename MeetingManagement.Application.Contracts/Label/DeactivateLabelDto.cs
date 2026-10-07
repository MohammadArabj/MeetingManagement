using System;
using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.Label;

public class DeactivateLabelDto(Guid guid) : ICommand
{
    public Guid Guid { get; set; } = guid;
}