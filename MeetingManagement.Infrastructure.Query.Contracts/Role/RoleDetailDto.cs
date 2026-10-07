using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.Role;

public class RoleDetailDto
{
    public int Id { get; set; }
    public Guid Guid { get; set; }
    public string Title { get; set; }
    public string? Description { get; set; }
    public string Color { get; set; }
}