using System;
using System.Collections.Generic;
using System.Text;

namespace MeetingManagement.Infrastructure.Query.Contracts.Meeting
{
    public class MeetingFutureDto
    {
        public Guid Guid { get; set; }
        public string Title { get; set; }
        public string Place { get; set; }
        public string Date { get; set; }
        public int? Status { get; set; }
    }
}
