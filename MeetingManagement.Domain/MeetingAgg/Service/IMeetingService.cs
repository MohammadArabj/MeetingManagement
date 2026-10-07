using Epc.Core;
using MeetingManagement.Application.Contracts.Agenda;
using MeetingManagement.Application.Contracts.Member;

namespace MeetingManagement.Domain.MeetingAgg.Service;

public interface IMeetingService:IDomainService
{
    void AddAgendas(Meeting meeting,Guid creator, string systemGuid, List<AgendaDto>  agenda);
    string GetNumber(int categoryId);
    Task AddMembers(Meeting meeting, Guid creator, string systemGuid, List<MeetingMemberDto> agenda);

}