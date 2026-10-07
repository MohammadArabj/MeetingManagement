using Epc.Application.Command;
using System;

namespace MeetingManagement.Application.Contracts.BlockedTime;

public class CreateBlockedTimeDto : ICommand
{
    public string Date { get; set; } = string.Empty;
    public string StartTime { get; set; }
    public string EndTime { get; set; }
    public string? Description { get; set; }
    /// <summary>صاحب زمان عدم حضور = همیشه کاربر جاری (در سرور مقداردهی می‌شود)</summary>
    [MeetingManagement.Common.Security.CallerUser]
    public Guid UserGuid { get; set; }
}
