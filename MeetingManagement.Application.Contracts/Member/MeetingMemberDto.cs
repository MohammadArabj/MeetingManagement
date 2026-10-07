using System;
using Epc.Application.Command;
using MeetingManagement.Common.Extensions;
using Microsoft.AspNetCore.Http;

namespace MeetingManagement.Application.Contracts.Member;

public class MeetingMemberDto : ICommand
{
    public long? Id { get; set; }
    public string? Name { get; set; }
    public string? Comment { get; set; }
    public Guid? UserGuid { get; set; }
    public Guid? PositionGuid { get; set; }
    public string? Mobile { get; set; }
    public string? Email { get; set; }
    public string? Organization { get; set; }
    public bool IsExternal { get; set; }
    public int RoleId { get; set; }
    public Guid? ReplacementUserGuid { get; set; }
    public bool IsRemoved { get; set; }
    public Guid MeetingGuid { get; set; }
    public IFormFile? Profile { get; set; }
    public IFormFile? Signature { get; set; }
    public Guid? ProfileGuid { get; set; }
    public Guid? SignatureGuid { get; set; }
    public int? MainRoleId { get; set; }
    public string? PersNo { get; set; }
    public Guid? BoardMemberGuid { get; set; } // New field to identify source
    public Gender? Gender { get; set; }
}
