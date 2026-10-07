using System;
using System.Collections.Generic;

namespace MeetingManagement.Infrastructure.Query.Contracts.Resolution;

public class ResolutionSearchResultDto
{
    public long Id { get; set; }
    public string? Title { get; set; }
    public string? Decisions { get; set; }
    public string? Description { get; set; }
    public string? ResolutionDate { get; set; }
    public string MeetingDate { get; set; }
    public string? ActorName { get; set; }
    public string? Documents { get; set; }
    public string? Text { get; set; }
    public string? ResolutionNumber { get; set; }
    public string? MeetingTitle { get; set; }
    public string? MeetingNumber { get; set; }
    public Guid MeetingGuid { get; set; }
    public List<string> Followers { get; set; } = [];
    public List<string> Actors { get; set; } = [];
}