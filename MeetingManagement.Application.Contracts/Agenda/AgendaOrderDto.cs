using System.Collections.Generic;
using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.Agenda;
public class UpdateAgendaOrderRequest : ICommand
{
    public List<AgendaOrderDto> Agendas { get; set; } = [];
}

public class AgendaOrderDto : ICommand
{
    public long Id { get; set; }
    public byte SortOrder { get; set; }
}