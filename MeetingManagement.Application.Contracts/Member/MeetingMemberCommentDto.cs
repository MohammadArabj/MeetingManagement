using System;
using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.Member;

public class MeetingMemberCommentDto : ICommand
{
    public long MemberId { get; set; }
    public bool? IsPresent { get; set; }
    public bool? IsSign { get; set; }
    public string? Comment { get; set; }
    public Guid? Signer { get; set; }
}