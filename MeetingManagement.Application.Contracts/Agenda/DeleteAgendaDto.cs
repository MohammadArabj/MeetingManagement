using System;
using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.Agenda;

public class DeleteAgendaDto(Guid guid) : ICommand
{
    public Guid Guid { get; set; } = guid;
}