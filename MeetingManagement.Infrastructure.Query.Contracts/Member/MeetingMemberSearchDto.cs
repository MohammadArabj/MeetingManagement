using MeetingManagement.Common.Security;
using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.Member;

public class MeetingMemberSearchDto
{
    [CallerUser]
    public Guid UserGuid { get; set; }
    public Guid MeetingGuid { get; set; }
}