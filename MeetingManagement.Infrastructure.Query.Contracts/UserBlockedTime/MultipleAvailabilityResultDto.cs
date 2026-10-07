// DTOs/BlockedTime/CreateBlockedTimeDto.cs
using System.Collections.Generic;
using System.Linq;

namespace MeetingManagement.Infrastructure.Query.Contracts.UserBlockedTime
{
    public class MultipleAvailabilityResultDto
    {
        public List<AvailabilityResultDto> Results { get; set; } = new();
        public bool AllAvailable => Results.All(r => r.IsAvailable);
        public List<AvailabilityResultDto> Conflicts => Results.Where(r => !r.IsAvailable).ToList();
    }
}