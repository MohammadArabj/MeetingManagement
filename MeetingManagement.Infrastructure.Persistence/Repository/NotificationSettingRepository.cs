using Epc.EntityFramework;
using MeetingManagement.Domain.NotificationSettingAgg;
using Microsoft.EntityFrameworkCore;

namespace MeetingManagement.Infrastructure.Persistence.Repository;

public class NotificationSettingRepository(DbContext commandContext)
    : BaseRepository<int, NotificationSetting>(commandContext), INotificationSettingRepository;