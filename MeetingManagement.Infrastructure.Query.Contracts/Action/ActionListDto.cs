using System.ComponentModel;

namespace MeetingManagement.Infrastructure.Query.Contracts.Action;

public class ActionListDto
{
    public string Status { get; set; }
    public string Type { get; set; }
    public string Description { get; set; }
    public string Date { get; set; }
    public string? UserName { get; set; }
    public long Id { get; set; }
    public string StatusStr { get; set; }
    public string FollowStatus { get; set; }
}