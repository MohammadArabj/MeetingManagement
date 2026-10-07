using System;
using Epc.Application.Command;
using Microsoft.AspNetCore.Http;

namespace MeetingManagement.Application.Contracts.Meeting;

public class MeetingRiderDto:ICommand
{
    public Guid MeetingGuid { get; set; }
    public string? Rider { get; set; }
    public IFormFile? File { get; set; }
    public Guid? RiderGuid { get; set; }
}