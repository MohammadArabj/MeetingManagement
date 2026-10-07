using System;

namespace MeetingManagement.Application.Contracts.CategoryPermission;

public class CategoryPermissionDto
{
    public int CategoryId { get; set; }
    public Guid PositionGuid { get; set; }
}