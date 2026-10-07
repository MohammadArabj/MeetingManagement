using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Infrastructure.Query.Contracts.Agenda;
using MeetingManagement.Presentation.Facade.Contracts.Agenda;

namespace MeetingManagement.Presentation.Facade.Query;

public class AgendaQueryFacade(IQueryBusAsync queryBusAsync):IAgendaQueryFacade
{
    public async Task<Result<List<AgendaListDto>>> List(Guid meetingGuid) =>
        await queryBusAsync.Dispatch<Result<List<AgendaListDto>>, Guid>(meetingGuid);
}