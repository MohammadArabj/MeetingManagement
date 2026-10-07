using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.Agenda;

public class DeleteAgenda(long id) : ICommand
{
    public long Id { get; set; } = id;
}