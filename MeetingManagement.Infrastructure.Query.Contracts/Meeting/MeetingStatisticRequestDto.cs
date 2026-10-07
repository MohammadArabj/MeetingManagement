using System;
using MeetingManagement.Common.Extensions;

namespace MeetingManagement.Infrastructure.Query.Contracts.Meeting;

public class MeetingStatisticRequestDto
{
    public Guid PositionGuid { get; set; }
    public ReportType Type { get; set; }
}