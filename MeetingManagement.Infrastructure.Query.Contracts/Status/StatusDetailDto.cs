using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.Status;

public class StatusDetailDto
{
    public string Title { get; set; }
    public string? Description { get; set; }
    public Guid Guid { get; set; }
    public int Id { get; set; }
}