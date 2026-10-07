using System;
using MeetingManagement.Common.Extensions;

namespace MeetingManagement.Infrastructure.Query.Contracts.Meeting;

public class MeetingListSearchDto
{
    public Guid UserGuid { get; set; }
    public Guid PositionGuid { get; set; }
    public FilterType FilterType { get; set; }
    public bool CanViewAll { get; set; }
}
