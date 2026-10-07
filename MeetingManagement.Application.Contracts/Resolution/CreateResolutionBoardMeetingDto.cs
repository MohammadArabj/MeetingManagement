using Epc.Application.Command;
using Microsoft.AspNetCore.Http;
using System;
using System.Collections.Generic;
using MeetingManagement.Common.Extensions;

namespace MeetingManagement.Application.Contracts.Resolution;

public class CreateResolutionBoardMeetingDto: ICommand
{
    public long? Id { get; set; }
    public Guid MeetingGuid { get; set; }
    public string Title { get; set; }
    public string? Number { get; set; }
    public string? DecisionsMade { get; set; }
    public string? Description { get; set; }
    public string? Documentation { get; set; }
    public string? ContractNumber { get; set; }
    public double? ApprovedPrice { get; set; }
    public Guid? ParentMeetingGuid { get; set; }
    public long? ParentResolutionId { get; set; }
    public Guid? CommitteeMeetingGuid { get; set; }
    public long? CommitteeResolutionId { get; set; }
    public List<FileDto> Files { get; set; } = [];
    public List<BoardMeetingResolutionItemDto> Items { get; set; } = [];
}

public class BoardMeetingResolutionItemDto
{
    public int Id { get; set; }
    public List<ActorItem> Actors { get; set; } = []; // تغییر از Guid به لیست
    public string? Description { get; set; }
    public string? DueDate { get; set; }
    public ActionStatus? Status { get; set; }
    public AssignmentResult? Result { get; set; } // اضافه کردن Result
    public Guid? FollowerGuid { get; set; }
    public Guid? FollowerPositionGuid { get; set; }
    public bool IsRemoved { get; set; }
}
