using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.Status;

public class CreateStatusDto:ICommand
{
    public string Title { get; set; }
    public string? Description { get; set; }
}