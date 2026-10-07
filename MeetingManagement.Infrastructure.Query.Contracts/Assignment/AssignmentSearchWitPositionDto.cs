using System;
using System.Collections.Generic;
using System.Text;

namespace MeetingManagement.Infrastructure.Query.Contracts.Assignment
{
    public record AssignmentSearchWitPositionDto(int Id, Guid PositionGuid);
}
