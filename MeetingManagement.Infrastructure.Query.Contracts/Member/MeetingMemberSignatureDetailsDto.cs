using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.Member;

public class MeetingMemberSignatureDetailsDto
{
    public long Id { get; set; }
    public string? Comment { get; set; } = "";
    public bool Sign { get; set; }

}