using MeetingManagement.Domain.NotificationSettingAgg;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MeetingManagement.Infrastructure.Persistence.Mapping;
public class NotificationSettingMapping : IEntityTypeConfiguration<NotificationSetting>
{
    public void Configure(EntityTypeBuilder<NotificationSetting> builder)
    {
        builder.HasKey(x => x.Id);

        builder.HasOne(x => x.Event)
            .WithMany(x=>x.Settings)
            .HasForeignKey(x => x.NotificationEventId)
            .OnDelete(DeleteBehavior.NoAction);
        builder.HasOne(x => x.Template)
            .WithMany(x=>x.Settings)
            .HasForeignKey(x => x.NotificationTemplateId)
            .OnDelete(DeleteBehavior.NoAction);

    }
}