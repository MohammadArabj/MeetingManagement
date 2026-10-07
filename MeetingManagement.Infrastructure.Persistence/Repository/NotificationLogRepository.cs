using Epc.EntityFramework;
using MeetingManagement.Domain.NotificationLogAgg;
using Microsoft.EntityFrameworkCore;

namespace MeetingManagement.Infrastructure.Persistence.Repository;

public class NotificationLogRepository(DbContext commandContext)
    : BaseRepository<int, NotificationLog>(commandContext), INotificationLogRepository;