using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.Action;

public class DeleteActionDto(long id):ICommand
{
    public long Id { get; set; } = id;
}