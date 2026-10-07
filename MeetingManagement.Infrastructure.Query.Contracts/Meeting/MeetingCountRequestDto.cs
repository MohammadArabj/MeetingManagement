using System;
using System.Collections.Generic;
using System.Text;

namespace MeetingManagement.Infrastructure.Query.Contracts.Meeting;

public record MeetingCountRequestDto(Guid PositionGuid, Guid UserGuid);
