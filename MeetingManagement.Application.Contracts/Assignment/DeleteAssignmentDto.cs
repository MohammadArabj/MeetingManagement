using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.Assignment;

public class DeleteAssignmentDto(int id) : ICommand
{
    public int Id { get; set; } = id;
}