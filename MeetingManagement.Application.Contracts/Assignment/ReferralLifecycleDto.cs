using System;
using Epc.Application.Command;
using MeetingManagement.Common.Extensions;

namespace MeetingManagement.Application.Contracts.Assignment;

/// <summary>بازگشت ارجاع توسط ارجاع‌گیرنده به ارجاع‌دهنده (با شرح نتیجه).</summary>
public class ReturnReferralDto : ICommand
{
    public int AssignmentId { get; set; }
    public string Description { get; set; } = string.Empty;
    public AssignmentResult? Result { get; set; }
}

/// <summary>فراخوانی (پس‌گرفتن) ارجاع توسط ارجاع‌دهنده.</summary>
public class RecallReferralDto : ICommand
{
    public int AssignmentId { get; set; }
    public string? Reason { get; set; }
}
