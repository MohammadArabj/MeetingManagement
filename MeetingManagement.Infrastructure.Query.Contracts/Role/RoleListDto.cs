using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.Role;

public class RoleListDto
{
    public int Id { get; set; }
    public Guid Guid { get; set; }
    public string Title { get; set; }
    public string? Description { get; set; }
    public string Color { get; set; }
    public string Created { get; set; }
    public int IsActive { get; set; }
}