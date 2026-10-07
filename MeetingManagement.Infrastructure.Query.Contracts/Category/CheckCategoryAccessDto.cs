using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.Category;

public class CheckCategoryAccessDto(int categoryId, Guid positionGuid)
{
    public int CategoryId { get; } = categoryId;
    public Guid PositionGuid { get; } = positionGuid;
}