namespace MeetingManagement.Infrastructure.Query.Contracts.Assignment;

public class AssignmentResolutionDetails
{
    public int AssignmentId { get; set; }
    public string MeetingNumber { get; set; }
    public string MeetingTitle { get; set; }
    public string MeetingDate { get; set; }
    public int ResolutionNumber { get; set; }
    public string ResolutionText { get; set; }
    public bool IsFollower { get; set; }
}