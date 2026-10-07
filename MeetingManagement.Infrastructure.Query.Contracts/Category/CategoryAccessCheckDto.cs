using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.Category;

public class CategoryAccessCheckDto
{
    public Guid CategoryGuid { get; set; }
    public Guid PositionGuid { get; set; }
}