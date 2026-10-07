using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.Member;

public class MemberSearchDto
{
    public Guid MeetingGuid { get; set; }
    public Guid UserGuid { get; set; }

}