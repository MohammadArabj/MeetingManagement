#nullable enable
using System;
using System.Collections.Generic;
using Epc.Application.Command;
using MeetingManagement.Common.Extensions;
using Microsoft.AspNetCore.Http;

namespace MeetingManagement.Application.Contracts.Agenda;

public class AgendaDto : ICommand
{
    public long? Id { get; set; }
    public string? Text { get; set; }
    public byte Order { get; set; }
    public List<FileDto> Files { get; set; } = [];
    public IFormFile? File { get; set; }
    public bool IsRemoved { get; set; }
    public Guid MeetingGuid { get; set; }

}