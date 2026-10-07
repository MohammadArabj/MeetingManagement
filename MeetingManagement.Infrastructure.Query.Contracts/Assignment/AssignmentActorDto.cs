using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.Assignment;

public class AssignmentActorDto
{
    public Guid ActorPositionGuid { get; set; }
    public string ActorName { get; set; }
}