using System;

namespace MeetingManagement.Application.Contracts.Meeting;

public class CreateMeetingResultDto(Guid guid,string number)
{
    public Guid Guid { get; set; } = guid;
    public string Number { get; set; } = number;
}