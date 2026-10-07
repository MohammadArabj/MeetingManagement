using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.Room;

public class CreateRoomDto:ICommand
{
    public string Title { get;  set; }
    public string? Address { get; set; }
    public int Capacity { get; set; }
}
