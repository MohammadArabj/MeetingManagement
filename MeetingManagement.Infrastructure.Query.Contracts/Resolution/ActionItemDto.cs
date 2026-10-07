using MeetingManagement.Common.Extensions;

namespace MeetingManagement.Infrastructure.Query.Contracts.Resolution;

/// <summary>
/// آیتم اقدام در گزارش
/// </summary>
public class ActionItemDto
{
    public int ActionId { get; set; }
    public string ActionDate { get; set; }
    public string ActionText { get; set; }
    public ActionStatus ActionStatus { get; set; }
    public AssignmentResult? Result { get; set; }
    public string CreatedBy { get; set; }
    public string CreatedAt { get; set; }
    public int AttachmentsCount { get; set; }
}
