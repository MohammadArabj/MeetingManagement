using System;
using System.Collections.Generic;
using System.Text;

namespace MeetingManagement.Common.Extensions
{
    public record FileDto(long Id, bool IsRemoved, Guid FileGuid);
}
