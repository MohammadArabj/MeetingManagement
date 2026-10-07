namespace MeetingManagement.Infrastructure.Query.Contracts.BoardMember;

public class BoardMemberSearchDto
{
    public string? SearchTerm { get; set; }
    public bool? IsActive { get; set; }
    public string? Position { get; set; }
}