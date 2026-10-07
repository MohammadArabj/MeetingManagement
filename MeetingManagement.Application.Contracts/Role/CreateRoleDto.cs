using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.Role;

public class CreateRoleDto:ICommand
{
    public required string Title { get; set; }
    public string? Description { get; set; }
    public string Color { get; set; }
}