using MeetingManagement.Common.Security;
using System;
using MeetingManagement.Common.Extensions;

namespace MeetingManagement.Infrastructure.Query.Contracts.Meeting;

public class MeetingListSearchDto
{
    [CallerUser]
    public Guid UserGuid { get; set; }
    [CallerPosition]
    public Guid PositionGuid { get; set; }
    public FilterType FilterType { get; set; }
    [CallerHasPermission(Permissions.MeetingsViewAll)]
    public bool CanViewAll { get; set; }
}
