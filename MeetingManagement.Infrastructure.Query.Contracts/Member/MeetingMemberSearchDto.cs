using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.Member;

public class MeetingMemberSearchDto
{
    public Guid UserGuid { get; set; }
    public Guid MeetingGuid { get; set; }
}