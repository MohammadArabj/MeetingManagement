using System;
using System.Collections.Generic;
using System.Text;

namespace MeetingManagement.Infrastructure.Query.Contracts.Meeting;

public record CheckMeetingNumberDto(string Number, Guid CategoryGuid, Guid? MeetingGuid);

public class CheckMeetingNumberResultDto
{
    public bool IsDuplicate { get; set; }
    public string ExistingMeetingTitle { get; set; }
}