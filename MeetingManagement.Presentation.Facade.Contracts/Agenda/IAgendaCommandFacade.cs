using System.Threading.Tasks;
using Epc.Company.Query;
using Epc.Core;
using MeetingManagement.Application.Contracts.Agenda;

namespace MeetingManagement.Presentation.Facade.Contracts.Agenda;

public interface IAgendaCommandFacade:IFacadeService
{
    Task<Result<long>> CreateOrEdit(AgendaDto command);
    Task<Result<bool>> Delete(long id);
    Task<Result<bool>> Order(UpdateAgendaOrderRequest orders);
    Task<Result<bool>> DeleteFile(long id);
}