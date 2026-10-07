using Epc.Domain;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.AssignmentAgg;

namespace MeetingManagement.Domain.ActionAgg;

public class Action : EntityBase<long>
{
    public Action() { } // برای EF Core

    public Action(Guid creator, int assignmentId, string description, string actionDate, Guid userGuid, ActionType type) : base(creator)
    {
        AssignmentId = assignmentId;
        ActionDate = actionDate.ToDateTime();
        Description = description;
        UserGuid = userGuid;
        Type = type;
    }

    public void Edit(string actionDate, string? description)
    {
        ActionDate = actionDate.ToDateTime();
        Description = description;
    }
    public ActionStatus? Status { get; private set; } // وضعیت اقدام
    public ActionFollowStatus? FollowStatus { get; private set; }
    public ActionType Type { get; private set; }
    public Guid UserGuid { get; private set; }
    public string Description { get; private set; } // توضیحات اقدام
    public DateTime ActionDate { get; private set; } // تاریخ انجام اقدام
    public int AssignmentId { get; private set; }
    public Assignment Assignment { get; set; }
}