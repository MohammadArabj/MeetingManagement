using MeetingManagement.Common.Security;
using System;
using MeetingManagement.Common.Extensions;

namespace MeetingManagement.Infrastructure.Query.Contracts.Meeting;

public class MeetingStatisticRequestDto
{
    [CallerPosition]
    public Guid PositionGuid { get; set; }
    public ReportType Type { get; set; }
}