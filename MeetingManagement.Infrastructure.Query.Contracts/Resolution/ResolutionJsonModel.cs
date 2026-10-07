using System;
using System.Collections.Generic;

namespace MeetingManagement.Infrastructure.Query.Contracts.Resolution;

public class ResolutionJsonModel
{
    public long Id { get; set; }
    public string? Description { get; set; }
    public Guid? FileGuid { get; set; }
    public string Label { get; set; }
    public Guid LabelGuid { get; set; }
    public string? CommitteeResolution { get; set; }
    public string? CommitteeMeeting { get; set; }
    public string? FollowUpResolution { get; set; }
    public string? FollowUpMeeting { get; set; }
    public string? Number { get; set; }
    public double? ApprovedPrice { get; set; }
    public string? Documentation { get; set; }
    public string? ContractNumber { get; set; }
    public string? DecisionsMade { get; set; }
    public List<ResolutionAssignmentDto> Assignments { get; set; } = [];
    public string? Title { get; set; }
    public string? Text { get; set; }
}