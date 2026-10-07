using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.BoardMember;

public class BoardMemberComboDto
{
    public Guid Guid { get; set; }
    public string Title { get; set; }
    public string Position { get; set; }
    public string Mobile { get; set; }
    public Guid? ProfileImageGuid { get; set; }
}