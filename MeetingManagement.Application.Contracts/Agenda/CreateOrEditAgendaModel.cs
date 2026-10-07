using System;
using Epc.Application.Command;
using Microsoft.AspNetCore.Http;

namespace MeetingManagement.Application.Contracts.Agenda;

public class CreateOrEditAgendaModel : ICommand
{
    public Guid MeetingGuid { get; set; }
    public string? Text { get; set; }
    public IFormFile? FileGuid { get; set; }

}