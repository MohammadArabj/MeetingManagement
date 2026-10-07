using MeetingManagement.Common.Security;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MeetingManagement.Infrastructure.Query.Contracts.Meeting
{
    public class MeetingCalendarSearchDto
    {
        [CallerPosition]
        public Guid PositionGuid { get; set; }
        public string PersonalNo { get; set; }
        public DateTime StartDate { get; set; }  // ✅ اضافه شد
        public DateTime EndDate { get; set; }    // ✅ اضافه شد
    }
}
