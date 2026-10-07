using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.Meeting;

public class CheckSignGuidDto(Guid guid)
{
    public Guid Guid { get; set; } = guid;
}