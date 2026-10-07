using MeetingManagement.Common.Security;
using MeetingManagement.Common.Extensions;
using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.Resolution;

public class ResolutionSearchRequestDto
{

    [CallerPosition]

    public Guid PositionGuid { get; set; }
    [CallerUser]
    public Guid UserGuid { get; set; }
    public ActionType? Type { get; set; }
    public ActionFollowStatus? ApprovalStatus { get; set; }
    public ActionStatus? ActionStatus { get; set; }
    public string? Text { get; set; }
    public string? Title { get; set; }
    public string? MeetingTitle { get; set; }
    public string? MeetingNumber { get; set; }
    public Guid? FollowerGuid { get; set; }
    public Guid? ActorGuid { get; set; }
    public string? Decisions { get; set; }
    public string? Description { get; set; }
    public string? Documents { get; set; }
    public string? MeetingDateFrom { get; set; }
    public string? MeetingDateTo { get; set; }
    public string? ResolutionDate { get; set; }
    public string? ResolutionNumber { get; set; }
}