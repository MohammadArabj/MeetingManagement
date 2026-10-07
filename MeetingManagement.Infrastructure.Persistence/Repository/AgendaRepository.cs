using Epc.EntityFramework;
using MeetingManagement.Domain.MeetingAgg;
using Microsoft.EntityFrameworkCore;

namespace MeetingManagement.Infrastructure.Persistence.Repository;

public class AgendaRepository(DbContext commandContext) : BaseRepository<long, Agenda>(commandContext), IAgendaRepository;