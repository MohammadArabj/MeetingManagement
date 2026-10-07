using System;
using System.Collections.Generic;
using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.CategoryPermission;

public class SetCategoryPermissionDto:ICommand
{
    public int CategoryId { get; set; }
    public List<Guid> PositionGuids { get; set; } = [];
}