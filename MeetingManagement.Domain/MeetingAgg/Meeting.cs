using Epc.Application;
using Epc.Domain;
using MeetingManagement.Application.Contracts.Meeting;
using MeetingManagement.Domain.CategoryAgg;
using MeetingManagement.Domain.MeetingAgg.Service;
using MeetingManagement.Domain.MeetingStatusAgg;
using MeetingManagement.Domain.ResolutionAgg;
using MeetingManagement.Domain.RoomAgg;
using System;
using MeetingManagement.Domain.Shared.Access;

namespace MeetingManagement.Domain.MeetingAgg;

public class Meeting
{
    public Meeting()
    {

    }

    public Meeting(Guid creator, CreateMeetingDto request,IMeetingService service,IMeetingRepository repository,IRoomRepository roomRepository,ICategoryRepository categoryRepository) 
    {

        var categoryId = Convert.ToInt32(categoryRepository.GetIdBy(request.CategoryGuid.Value));
        Title = request.Title;
        Number =!string.IsNullOrEmpty(request.Number)?request.Number: service.GetNumber(Convert.ToInt32( categoryRepository.GetIdBy(request.CategoryGuid.Value)));
        StatusId = request.StatusId;
        Date = request.Date.ToGeorgianDateTime();
        RoomName = request.RoomName;
        RoomLink = request.RoomLink;
        RoomId = request.RoomGuid != null ? Convert.ToInt32(roomRepository.GetIdBy(request.RoomGuid.Value)) : null;
        CategoryId = categoryId;
        FollowGuid =request.FollowGuid ;
        StartTime= request.StartTime;
        EndTime = request.EndTime;
        NotAllowReplacement = request.NotAllowReplacement;
        CreatorPositionGuid= request.CreatorPositionGuid;
        var now = DateTime.Now.Date.Date;
        var startDateTime = Date?.Date;
        if (startDateTime < now&&StatusId != MeetingStatusIds.Draft)
        {
            StatusId = MeetingStatusIds.Held;
        }

        IsActive = 1;
        IsLocked=0;
        IsRemoved = false;
        CreatedBy = creator;
        Created=DateTime.Now;
        Guid = System.Guid.NewGuid();
    }

    public void Edit(Guid actor, CreateMeetingDto request, IMeetingService service, IMeetingRepository repository,
    IRoomRepository roomRepository, ICategoryRepository categoryRepository)
    {
        var categoryId = Convert.ToInt32(categoryRepository.GetIdBy(request.CategoryGuid.Value));

        // ✅ اگه دسته‌بندی عوض شده، شماره باید با فرمت دسته‌ی جدید بازتولید بشه
        if (CategoryId.HasValue && CategoryId.Value != categoryId)
        {
            Number = service.GetNumber(categoryId);
        }

        Title = request.Title;
        Date = request.Date.ToGeorgianDateTime();
        RoomName = request.RoomName;
        RoomLink = request.RoomLink;
        RoomId = request.RoomGuid != null ? Convert.ToInt32(roomRepository.GetIdBy(request.RoomGuid.Value)) : null;
        CategoryId = categoryId;
        StartTime = request.StartTime;
        EndTime = request.EndTime;
        FollowGuid = request.FollowGuid;
        NotAllowReplacement = request.NotAllowReplacement;
        LastModifiedBy = actor;
        LastModified = DateTime.Now;
    }

    public void EditDescription(Guid actor, string description)
    {
        Description = description;
        LastModifiedBy = actor;
        LastModified = DateTime.Now;
    }

    public void EditRider(Guid actor, string rider, Guid? fileGuid)
    {
        Rider = rider;
        RiderGuid = fileGuid;
        LastModifiedBy = actor;
        LastModified = DateTime.Now;
    }

    public void ChangeStatus(Guid editor, int statusId)
    {
        StatusId = statusId;
        LastModifiedBy = editor;
        if(statusId==6)
            EndDate=DateTime.Now;
        LastModified = DateTime.Now;
    }

    public long Id { get; set; }
    public Guid? Guid { get; set; }
    public string? Title { get; set; }
    public DateTime? Date { get;private set; }
    public TimeSpan? StartTime { get; set; }
    public TimeSpan? EndTime { get; set; }
    public string? Rider { get;private set; }
    public Guid? RiderGuid { get; set; }
    public string? Summary { get;private set; }
    public string? RoomName { get;private set; }
    public string? Description { get;private set; }
    public string? RoomLink { get;private set; }
    public string? Number { get;private set; }
    public int? StatusId { get;private set; }
    public int? RoomId { get;private set; }
    public int? CategoryId { get;private set; }
    public Guid? FollowGuid { get;private set; }
    public bool? NotAllowReplacement { get; private set; }
    public int? IsLocked { get; private set; }

    public bool? IsRemoved { get; private set; }
    public int? IsActive { get; set; }

    public DateTime? LastModified { get; private set; }

    public Guid? LastModifiedBy { get; private set; }
    public DateTime? Created { get; private set; }

    public Guid? CreatedBy { get; private set; }
    public DateTime? EndDate { get;private set; }
    public MeetingStatus? Status { get; set; }
    public Room? Room { get; set; }
    public Category? Category { get; set; }
    public Guid? CreatorPositionGuid { get; set; }
    public List<Agenda> Agendas { get; set; } = [];
    public List<MeetingMember> MeetingMembers { get; set; }= [];
    public List<Resolution> Resolutions { get; set; } = [];

}

