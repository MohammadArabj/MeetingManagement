using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.BoardMember;
public class BoardMemberDto
{
    public Guid Guid { get; set; }
    public string FirstName { get; set; }
    public string LastName { get; set; }
    public string Mobile { get; set; }
    public string Position { get; set; }
    public string FullName => $"{FirstName} {LastName}";
    public Guid? ProfileImageGuid { get; set; }
    public int IsActive { get; set; }
    public string CreatedDate { get; set; }
    public string StartDate { get; set; }
    public string EndDate { get; set; }
    public string? Company { get; set; }
}