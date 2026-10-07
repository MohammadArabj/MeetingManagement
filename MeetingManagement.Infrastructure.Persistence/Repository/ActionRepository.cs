using Epc.EntityFramework;
using MeetingManagement.Domain.ActionAgg;
using Microsoft.EntityFrameworkCore;
using Action = MeetingManagement.Domain.ActionAgg.Action;

namespace MeetingManagement.Infrastructure.Persistence.Repository;

public class ActionRepository(DbContext commandContext)
    : BaseRepository<long, Action>(commandContext), IActionRepository;
