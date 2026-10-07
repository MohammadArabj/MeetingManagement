using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.Status;

public class StatusListDto
{
    public Guid Guid { get; set; }
    public string Title { get; set; }
    public string? Description { get; set; }
    public string Created { get; set; }
    public int IsActive { get; set; }
    public int Id { get; set; }
}