using Epc.EntityFramework;
using MeetingManagement.Domain.NotificationEventAgg;
using Microsoft.EntityFrameworkCore;

namespace MeetingManagement.Infrastructure.Persistence.Repository;

public class NotificationEventRepository(DbContext commandContext)
    : BaseRepository<int, NotificationEvent>(commandContext), INotificationEventRepository;