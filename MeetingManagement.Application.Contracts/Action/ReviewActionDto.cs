using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.Action;
public class ReviewActionDto : ICommand
{
    public long Id { get; set; }
    public bool IsApproved { get; set; }
    public string? Comment { get; set; }
}
