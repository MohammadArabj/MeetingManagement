using System;
using MeetingManagement.Common.Extensions;

namespace MeetingManagement.Infrastructure.Query.Contracts.Resolution;

public class ResolutionAssignmentDto
{
    public int Id { get; set; }
    public string? FollowerName { get; set; }
    public string? ActorName { get; set; }
    public string? FollowUpDate { get; set; }
    public string? DueDate { get; set; }
    public string? Type { get; set; }
    public string? AssignmentType { get; set; }
    public Guid? FollowerGuid { get; set; }
    public Guid? FollowerPositionGuid { get; set; }
    public Guid? ActorGuid { get; set; }
    public Guid? ActorPositionGuid { get; set; }
    public AssignmentResult? Result { get; set; }
    public ActionStatus? Status { get; set; }
}