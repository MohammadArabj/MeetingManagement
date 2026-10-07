using System;

namespace MeetingManagement.Application.Contracts.Meeting;

public class EditMeetingDto:CreateMeetingDto
{
    public Guid Guid { get; set; }
    public Guid? CreatedBy { get; set; }
}