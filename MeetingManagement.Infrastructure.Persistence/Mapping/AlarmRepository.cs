using Epc.EntityFramework;
using MeetingManagement.Domain.AlarmAgg;
using Microsoft.EntityFrameworkCore;

namespace MeetingManagement.Infrastructure.Persistence.Mapping;

public class AlarmRepository(DbContext commandContext) : BaseRepository<int, Alarm>(commandContext), IAlarmRepository;