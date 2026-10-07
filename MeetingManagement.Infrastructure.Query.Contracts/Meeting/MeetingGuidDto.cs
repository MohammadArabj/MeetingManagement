using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MeetingManagement.Infrastructure.Query.Contracts.Meeting;
public class MeetingGuidDto(Guid guid)
{
    public Guid Guid { get; set; } = guid;
}
