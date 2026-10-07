using System;
using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.BoardMember;

public class CreateBoardMemberDto : ICommand
{
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Mobile { get; set; }
    public Guid? ProfileImageGuid { get; set; }  // فقط GUID - بدون IFormFile
    public string? Position { get; set; }
    public string? StartDate { get; set; }
    public string? EndDate { get; set; }
    public string? Company { get; set; }
}