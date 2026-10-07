// DTOs/BlockedTime/CreateBlockedTimeDto.cs
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace MeetingManagement.Infrastructure.Query.Contracts.UserBlockedTime
{
    // DTOs/BlockedTime/CheckMultipleAvailabilityDto.cs
    public class CheckMultipleAvailabilityDto
    {
        public List<Guid> UserGuids { get; set; } = [];

        [Required]
        public string Date { get; set; } = string.Empty;

        [Required]
        public string StartTime { get; set; } = string.Empty;

        [Required]
        public string EndTime { get; set; } = string.Empty;
    }
}