using System.Collections.Generic;
using System.Linq;

namespace MeetingManagement.Infrastructure.Query.Contracts.BlockedTime;

public class MultipleAvailabilityResultModel
{
    public List<AvailabilityResultModel> Results { get; set; } = [];
    public bool AllAvailable => Results.All(r => r.IsAvailable);
    public List<AvailabilityResultModel> Conflicts => Results.Where(r => !r.IsAvailable).ToList();
}