using MeetingManagement.Domain.AlarmAgg;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MeetingManagement.Infrastructure.Persistence.Mapping;

public class AlarmReceiverMapping:IEntityTypeConfiguration<AlarmReceiver>
{
    public void Configure(EntityTypeBuilder<AlarmReceiver> builder)
    {
        builder.HasKey(x => x.Id);
        builder.HasOne(x => x.Alarm)
            .WithMany(x => x.Receivers)
            .HasForeignKey(x => x.Id);
    }
}