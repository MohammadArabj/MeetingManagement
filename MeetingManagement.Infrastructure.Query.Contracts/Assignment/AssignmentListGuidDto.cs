using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MeetingManagement.Infrastructure.Query.Contracts.Assignment;
public class AssignmentListGuidDto(Guid guid)
{
    public Guid Guid { get; set; } = guid;
}
