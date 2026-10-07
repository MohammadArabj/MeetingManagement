using System;
using System.Collections.Generic;
using System.Text;

namespace MeetingManagement.Infrastructure.Query.Contracts.Meeting
{
    public record MeetingFutureRequestDto(Guid? UserGuid, Guid? PositionGuid);
}
