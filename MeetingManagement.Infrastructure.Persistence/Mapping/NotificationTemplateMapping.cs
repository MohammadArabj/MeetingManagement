using MeetingManagement.Domain.NotificationTemplateAgg;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MeetingManagement.Infrastructure.Persistence.Mapping;

public class NotificationTemplateMapping : IEntityTypeConfiguration<NotificationTemplate>
{
    public void Configure(EntityTypeBuilder<NotificationTemplate> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Title).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Content).IsRequired().HasMaxLength(1000);
        builder.HasMany(x => x.Settings)
            .WithOne(x => x.Template)
            .HasForeignKey(x => x.NotificationTemplateId);

        builder.HasOne(x => x.Event)
            .WithMany(x=>x.Templates)
            .HasForeignKey(x => x.NotificationEventId)
            .OnDelete(DeleteBehavior.NoAction);


    }
}