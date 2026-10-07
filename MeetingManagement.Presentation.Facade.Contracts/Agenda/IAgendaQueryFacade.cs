using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Epc.Company.Query;
using Epc.Core;
using MeetingManagement.Infrastructure.Query.Contracts.Agenda;

namespace MeetingManagement.Presentation.Facade.Contracts.Agenda;

public interface IAgendaQueryFacade:IFacadeService
{
    Task<Result<List<AgendaListDto>>> List(Guid meetingGuid);
}