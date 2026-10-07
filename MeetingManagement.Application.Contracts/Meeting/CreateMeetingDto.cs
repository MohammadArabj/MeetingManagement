using System;
using System.Collections.Generic;
using Epc.Application.Command;
using MeetingManagement.Application.Contracts.Agenda;
using MeetingManagement.Application.Contracts.Member;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace MeetingManagement.Application.Contracts.Meeting;
//[OperationLog]
public class CreateMeetingDto:ICommand
{
    public Guid? Guid { get; set; }
    public  string? Title { get; set; }
    public  string? Date { get; set; }
    public TimeSpan? StartTime { get; set; }
    public TimeSpan? EndTime { get; set; }
    public string? RoomName { get; set; }
    public Guid? BoardMemberGuid { get; set; }
    public string? RoomLink { get; set; }
    public int? StatusId { get; set; }
    public bool? NotAllowReplacement { get; set; }
    public bool SendNotification { get; set; }
    public bool IsBoardMeeting { get; set; }
    public Guid? RoomGuid { get; set; }
    public Guid? CategoryGuid { get; set; }
    public Guid? FollowGuid { get; set; }
    public Guid? CreatorPositionGuid { get; set; }
    public List<AgendaDto> Agendas { get; set; }= [];
    public List<MeetingMemberDto> Members { get; set; } = [];
    public string? Number { get; set; }
}