using MeetingManagement.Domain.RoomAgg;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MeetingManagement.Infrastructure.Persistence.Mapping;

public class RoomMapping:IEntityTypeConfiguration<Room>
{
    public void Configure(EntityTypeBuilder<Room> builder)
    {
        #region Properties
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Title).HasMaxLength(200).IsRequired();
        builder.Property(x => x.Address).HasMaxLength(400);
        builder.Property(x => x.IsActive);
        builder.Property(x => x.Guid);
        builder.Property(x => x.IsRemoved);
        builder.Property(x => x.IsLocked);
        builder.Property(x => x.Created);
        builder.Property(x => x.CreatedBy);
        builder.Property(x => x.LastModified);
        builder.Property(x => x.LastModifiedBy);
        builder.Ignore(x => x.EventAggregator);
        #endregion

        #region Relations
        builder.HasMany(c => c.Meetings)
            .WithOne(c => c.Room)
            .HasForeignKey(c => c.RoomId);
        #endregion
    }
}