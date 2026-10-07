using System;
using System.Collections.Generic;
using System.IO;
using Epc.Application.Command;
using Microsoft.AspNetCore.Http;

namespace MeetingManagement.Application.Contracts.Meeting;

public class MeetingAttachmentDto:ICommand
{
    public Guid MeetingGuid { get; set; }
    public List<Guid> Files { get; set; } = [];
}