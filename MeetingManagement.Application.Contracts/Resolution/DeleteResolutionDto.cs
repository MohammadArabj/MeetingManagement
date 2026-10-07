using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.Resolution;

public class DeleteResolutionDto:ICommand
{
    public long Id { get; set; }
}