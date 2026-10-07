using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.Label;

public class CreateLabelDto : ICommand
{
    public required string Title { get; set; }
    public string? Description { get; set; }
    public string Color { get; set; }
}