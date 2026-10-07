using MeetingManagement.Common.Security;
using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.Meeting;

public class MeetingSearchRequestDto
{
    [CallerPosition]
    public Guid PositionGuid { get; set; }
    [CallerUser]
    public Guid UserGuid { get; set; }
    public string? Title { get; set; }
    public Guid? RoomGuid { get; set; }
    public Guid? CategoryGuid { get; set; }
    public string? Agenda { get; set; }
    public Guid? ChairmanGuid { get; set; }
    public Guid? SecretaryGuid { get; set; }
    public string? Number { get; set; }
    public string? DateFrom { get; set; }
    public string? DateTo { get; set; }
    public Guid? StatusGuid { get; set; }

}