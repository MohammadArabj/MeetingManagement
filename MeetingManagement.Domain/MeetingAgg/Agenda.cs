using Epc.Domain;
using MeetingManagement.Application.Contracts.Agenda;

namespace MeetingManagement.Domain.MeetingAgg;

public class Agenda 
{
    public Agenda()
    {

    }
    public Agenda(Guid creator, AgendaDto agenda,long meetingId) 
    {
        SortOrder = agenda.Order;
        Text = agenda.Text;
       // File = agenda.FileGuid;
        MeetingId = meetingId;
        Created = DateTime.Now;
        CreatedBy = creator;
    }

    public void Edit(AgendaDto agenda)
    {
        Text = agenda.Text;
       // File = agenda.FileGuid;
    }
    public long Id { get; set; }

    public string? Text { get; private set; }
    public byte? SortOrder { get;  set; }
    public Guid? File { get;  set; }
    public Guid? CreatedBy { get; set; }
    public DateTime? Created { get; set; }
    public int? IsActive { get; set; }
    public long? MeetingId { get; private set; }
    public Meeting Meeting { get; set; }
}