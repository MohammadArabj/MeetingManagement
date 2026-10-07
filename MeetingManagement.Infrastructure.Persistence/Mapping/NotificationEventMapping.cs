using System.Security.Cryptography.X509Certificates;
using MeetingManagement.Domain.NotificationEventAgg;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MeetingManagement.Infrastructure.Persistence.Mapping;

public class NotificationEventMapping:IEntityTypeConfiguration<NotificationEvent>
{
    public void Configure(EntityTypeBuilder<NotificationEvent> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Title).IsRequired().HasMaxLength(200);
        builder.Property(x=>x.Description).IsRequired().HasMaxLength(500);
        builder.HasMany(x => x.Settings).WithOne(x=>x.Event).HasForeignKey(x => x.NotificationEventId).OnDelete(DeleteBehavior.NoAction);
        builder.HasMany(x => x.Logs).WithOne(x=>x.Event).HasForeignKey(x => x.NotificationEventId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(x => x.Templates).WithOne(x => x.Event).HasForeignKey(x => x.NotificationEventId).OnDelete(DeleteBehavior.NoAction);
    }
}