using System;
using System.Collections.Generic;

namespace MeetingManagement.Infrastructure.Query.Contracts.Meeting;

public class MeetingJsonModel
{
    public long? Id { get; set; }
    public string Number { get; set; }
    public string Title { get; set; }
    public string Date { get; set; }
    public string Status { get; set; }
    public int StatusId { get; set; }
    public string Location { get; set; }
    public string? Chairman { get; set; }
    public string? Secretary { get; set; }
    public string? StartTime { get; set; }
    public string? EndTime { get; set; }
    public string? MtDate { get; set; }
    public string? Description { get; set; }
    public string Role { get; set; }
    public Guid Guid { get; set; }
    public string Category { get; set; }
    public int? RoleId { get; set; }
    public string? Creator { get; set; }
    public string? Rider { get; set; }
    public Guid? RiderGuid { get; set; }
    public List<Guid?> UserGuids { get; set; } = [];
    public List<AgendaItem> Agendas { get; set; } = [];
    public string? FollowMeeting { get; set; }
    public bool NotAllowReplacement { get; set; }
    public Guid CategoryGuid { get; set; }
    public string Created { get; set; }
}

public class AgendaItem
{
    public long Id { get; set; }
    public string? Text { get; set; } = "";
    public Guid? FileGuid { get; set; }
}