// Assignment Referral DTOs
using Epc.Application.Command;
using System;

namespace MeetingManagement.Application.Contracts.Assignment;

public class AssignmentReferralDto:ICommand
{
    public int ParentAssignmentId { get; set; }
    public Guid ActorGuid { get; set; }
    public Guid? ActorPositionGuid { get; set; }
    public string DueDate { get; set; }
    public string ReferralNote { get; set; }
    public Guid? ReferrerPositionGuid { get; set; }
}
