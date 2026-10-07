using MeetingManagement.Common.Security;
using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.Category;

public class CategoryAccessCheckDto
{
    public Guid CategoryGuid { get; set; }
    [CallerPosition]
    public Guid PositionGuid { get; set; }
}