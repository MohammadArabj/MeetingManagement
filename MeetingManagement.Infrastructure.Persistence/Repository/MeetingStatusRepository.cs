using Epc.EntityFramework;
using MeetingManagement.Domain.MeetingStatusAgg;
using Microsoft.EntityFrameworkCore;

namespace MeetingManagement.Infrastructure.Persistence.Repository;

public class MeetingStatusRepository(DbContext commandContext)
    : BaseRepository<int, MeetingStatus>(commandContext), IMeetingStatusRepository;   
