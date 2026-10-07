// MeetingManagement.Infrastructure.Persistence/Mapping/BlockedTimeMapping.cs
using MeetingManagement.Domain.BlockedTimeAgg;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MeetingManagement.Infrastructure.Persistence.Mapping;

public class BlockedTimeMapping : IEntityTypeConfiguration<BlockedTime>
{
    public void Configure(EntityTypeBuilder<BlockedTime> builder)
    {
        builder.ToTable("BlockedTimes");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.UserGuid).IsRequired();
        builder.Property(x => x.Date).IsRequired();
        builder.Property(x => x.StartTime).IsRequired();
        builder.Property(x => x.EndTime).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(500);

        builder.Property(x => x.Guid);
        builder.Property(x => x.IsActive);
        builder.Property(x => x.IsRemoved);
        builder.Property(x => x.IsLocked);
        builder.Property(x => x.Created);
        builder.Property(x => x.CreatedBy);
        builder.Property(x => x.LastModified);
        builder.Property(x => x.LastModifiedBy);

        builder.Ignore(x => x.EventAggregator);

        // Indexes
        builder.HasIndex(x => x.UserGuid);
        builder.HasIndex(x => x.Date);
        builder.HasIndex(x => new { x.UserGuid, x.Date });
    }
}