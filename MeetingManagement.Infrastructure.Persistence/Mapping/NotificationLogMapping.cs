using MeetingManagement.Domain.NotificationLogAgg;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MeetingManagement.Infrastructure.Persistence.Mapping;

public class NotificationLogMapping:IEntityTypeConfiguration<NotificationLog>
{
    public void Configure(EntityTypeBuilder<NotificationLog> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.ErrorMessage).IsRequired(false).HasMaxLength(3000);
        builder.Property(x => x.Message).IsRequired().HasMaxLength(4000);

        builder.HasOne(x => x.Event)
            .WithMany(x=>x.Logs)
            .HasForeignKey(x => x.NotificationEventId)
            .OnDelete(DeleteBehavior.NoAction);

    }
}