using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.Meeting;

public class DeleteMeetingMember(long id):ICommand
{
    public long Id { get; set; } = id;
}