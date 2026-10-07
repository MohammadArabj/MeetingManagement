using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.Label;

public class LabelDetailDto
{
    public int Id { get; set; }
    public Guid Guid { get; set; }
    public string Title { get; set; }
    public string Color { get; set; }
    public string? Description { get; set; }
}