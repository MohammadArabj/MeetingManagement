using Epc.Logging;
using MeetingManagement.Domain.AlarmAgg;
using MeetingManagement.Domain.AssignmentAgg;
using MeetingManagement.Domain.BlockedTimeAgg;
using MeetingManagement.Domain.BoardMemberAgg;
using MeetingManagement.Domain.CategoryAgg;
using MeetingManagement.Domain.LabelAgg;
using MeetingManagement.Domain.MeetingAgg;
using MeetingManagement.Domain.MeetingStatusAgg;
using MeetingManagement.Domain.NotificationEventAgg;
using MeetingManagement.Domain.NotificationLogAgg;
using MeetingManagement.Domain.NotificationSettingAgg;
using MeetingManagement.Domain.NotificationTemplateAgg;
using MeetingManagement.Domain.ResolutionAgg;
using MeetingManagement.Domain.RoleAgg;
using MeetingManagement.Domain.RoomAgg;
using MeetingManagement.Domain.SettingAgg;
using MeetingManagement.Infrastructure.Persistence.Mapping;
using Microsoft.EntityFrameworkCore;
using Action = MeetingManagement.Domain.ActionAgg.Action;
using File = MeetingManagement.Domain.FileAgg.File;
using MeetingMember = MeetingManagement.Domain.MeetingAgg.MeetingMember;

namespace MeetingManagement.Infrastructure.Persistence;

public class MeetingManagementQueryContext(DbContextOptions<MeetingManagementQueryContext> options) : DbContext(options)
{
    public DbSet<Meeting> Meetings { get; set; }
    public DbSet<MeetingMember> MeetingsMembers { get; set; }
    public DbSet<OperationLog> OperationLogs { get; set; }
    public DbSet<Agenda> Agendas { get; set; }
    public DbSet<Resolution> Resolutions { get; set; }
    public DbSet<Category> Categories { get; set; }
    public DbSet<Room> Rooms { get; set; }
    public DbSet<Assignment> Assignments { get; set; }
    public DbSet<Domain.ActionAgg.Action> Actions { get; set; }
    public DbSet<MeetingStatus> MeetingStatuses { get; set; }
    public DbSet<Label> Labels { get; set; }
    public DbSet<Role> Roles { get; set; }
    public DbSet<File> Files { get; set; }
    public DbSet<NotificationTemplate> NotificationTemplates { get; set; }
    public DbSet<NotificationSetting> NotificationSettings { get; set; }
    public DbSet<NotificationLog> NotificationLogs { get; set; }
    public DbSet<NotificationEvent> NotificationEvents { get; set; }
    public DbSet<Alarm> Alarms { get; set; }
    public DbSet<AlarmReceiver> AlarmsReceivers { get; set; }
    public DbSet<BoardMember> BoardMembers { get; set; }
    public DbSet<CategoryPermission> CategoryPermissions { get; set; }
    public DbSet<BlockedTime> BlockedTimes { get; set; }
    public DbSet<SystemSetting> SystemSettings { get; set; }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        builder.HasDefaultSchema("dbo");
        var assembly = typeof(MeetingMapping).Assembly;
        builder.ApplyConfigurationsFromAssembly(assembly);

        base.OnModelCreating(builder);
    }

}