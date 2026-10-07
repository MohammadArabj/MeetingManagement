using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.Agenda;

public class DeleteAgendaFileDto(long id):ICommand
{
    public long Id { get; set; } = id;

}