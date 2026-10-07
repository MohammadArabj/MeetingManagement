using System;
using System.Collections.Generic;
using Epc.Application.Command;
using MeetingManagement.Common.Extensions;

namespace MeetingManagement.Application.Contracts.Resolution;

public class CreateResolutionDto : ICommand
{
    /// <summary>شناسه مصوبه (long؛ قبلاً int بود و با نوع ستون همخوانی نداشت)</summary>
    public long? Id { get; set; }
    public string? Description { get; set; }
    public Guid MeetingGuid { get; set; }
    public List<FileDto> Files { get; set; } = [];
    public List<AssignmentItem> Assignments { get; set; } = [];
}

public class AssignmentItem
{
    public List<ActorItem> Actors { get; set; } = [];
    public ActorItem? Follower { get; set; }
    public AssignmentType Type { get; set; }
    public string? DueDate { get; set; }
}

public class ActorItem
{
    public int Id { get; set; }
    public Guid UserGuid { get; set; }

    /// <summary>
    /// ✅ FIX: nullable — کاربران بدون سمت از فرانت با positionGuid خالی ارسال می‌شدند
    /// و Model Binding کل درخواست را با 400 رد می‌کرد («ثبت نمی‌شود»).
    /// </summary>
    public Guid? PositionGuid { get; set; }
    public bool IsRemoved { get; set; }
}
