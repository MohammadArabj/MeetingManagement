using MeetingManagement.Common.Security;
using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.Meeting;

public class MeetingSearchDto
{
    public Guid MeetingGuid { get; set; }
    [CallerUser]
    public Guid UserGuid { get; set; }
    [CallerPosition]
    public Guid PositionGuid { get; set; }
    [CallerHasPermission(Permissions.MeetingsViewAll)]
    public bool CanView { get; set; }
}