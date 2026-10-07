using Epc.EntityFramework;
using MeetingManagement.Domain.NotificationTemplateAgg;
using Microsoft.EntityFrameworkCore;

namespace MeetingManagement.Infrastructure.Persistence.Repository;

public class NotificationTemplateRepository(DbContext commandContext)
    : BaseRepository<int, NotificationTemplate>(commandContext), INotificationTemplateRepository;