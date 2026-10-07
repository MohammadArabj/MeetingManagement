using System;
using System.ComponentModel.DataAnnotations;

namespace MeetingManagement.Infrastructure.Query.Contracts.UserBlockedTime
{
    public class CheckAvailabilityDto
    {
        public Guid UserGuid { get; set; }

        public string Date { get; set; } = string.Empty;

        public string StartTime { get; set; } = string.Empty;

        public string EndTime { get; set; } = string.Empty;
    }
}