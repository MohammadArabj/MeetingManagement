using Epc.Application.Command;
using Epc.Application.Query;
using Epc.Company.Query;
using Epc.Core;
using Epc.Domain;
using Epc.Identity;
using MeetingManagement.Application.Contracts.BoardMember;
using MeetingManagement.Domain.CategoryAgg;
using MeetingManagement.Domain.CategoryAgg.Service;
using MeetingManagement.Domain.MeetingAgg;
using MeetingManagement.Domain.MeetingAgg.Service;
using MeetingManagement.Domain.Shared.Acls.UserManagement;
using Microsoft.AspNetCore.DataProtection.KeyManagement;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Diagnostics.Metrics;
using System.Security.Cryptography.Xml;
using System.Xml.Linq;
using Epc.Application;
using static Dapper.SqlMapper;
using static Microsoft.AspNetCore.Hosting.Internal.HostingApplication;

namespace MeetingManagement.Domain.BoardMemberAgg;

public class BoardMember : AuditableAggregateRootBase<int>
{
    public BoardMember()
    {
    }

    public BoardMember(Guid creator, string firstName, string lastName, string? mobile,string position,string? startDate,string? endDate,string? company, Guid? profileImageGuid) : base(creator)
    {
        FirstName = firstName;
        LastName = lastName;
        Company = company;
        Mobile = mobile;
        Position = position;
        StartDate = !string.IsNullOrEmpty(startDate) ? startDate.ToGeorgianDateTime() : null; 
        EndDate = !string.IsNullOrEmpty(endDate) ? endDate.ToGeorgianDateTime() : null;
        ProfileImageGuid = profileImageGuid;
    }

    public void Edit(Guid editor, string firstName, string lastName, string? mobile,string position,string? startDate,string? endDate, string? company, Guid? profileImageGuid)
    {
        FirstName = firstName;
        LastName = lastName;
        Mobile = mobile;
        Company = company;
        ProfileImageGuid = profileImageGuid;
        Position = position;
        StartDate = !string.IsNullOrEmpty(startDate) ? startDate.ToGeorgianDateTime() : null;
        EndDate = !string.IsNullOrEmpty(endDate) ? endDate.ToGeorgianDateTime() : null;
        Modified(editor);
    }

    public void Activate(Guid actor)
    {
        Activate();
        Modified(actor);
    }

    public void Deactivate(Guid actor)
    {
        Deactivate();
        Modified(actor);
    }

    public string FirstName { get; private set; }
    public string LastName { get; private set; }
    public string? Company { get; private set; }
    public string? Mobile { get; private set; }
    public string? Position { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public Guid? ProfileImageGuid { get; private set; }

    public string FullName => $"{FirstName} {LastName}";
    public List<MeetingMember> MeetingMembers { get; set; } = [];
}


