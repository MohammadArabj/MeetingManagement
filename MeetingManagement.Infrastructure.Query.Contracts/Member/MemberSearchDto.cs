using MeetingManagement.Common.Security;
using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.Member;

public class MemberSearchDto
{
    public Guid MeetingGuid { get; set; }
    [CallerUser]
    public Guid UserGuid { get; set; }

}