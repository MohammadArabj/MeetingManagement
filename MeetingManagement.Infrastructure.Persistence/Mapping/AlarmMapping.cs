using MeetingManagement.Domain.AlarmAgg;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MeetingManagement.Infrastructure.Persistence.Mapping;

public class AlarmMapping:IEntityTypeConfiguration<Alarm>
{
    public void Configure(EntityTypeBuilder<Alarm> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Message).IsRequired().HasMaxLength(1000);
        builder.Property(x=>x.Title).IsRequired().HasMaxLength(200);
        builder.HasMany(x => x.Receivers)
            .WithOne(x => x.Alarm)
            .HasForeignKey(x => x.AlarmId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
