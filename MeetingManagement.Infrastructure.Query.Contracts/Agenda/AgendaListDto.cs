using MeetingManagement.Common.Extensions;
using System;
using System.Collections.Generic;

namespace MeetingManagement.Infrastructure.Query.Contracts.Agenda;

public class AgendaListDto
{
    public long Id { get; set; }
    public string? Text { get; set; }
    public List<FileDto> Files { get; set; } = [];
}