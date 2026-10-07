using MeetingManagement.Domain.MeetingStatusAgg;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MeetingManagement.Infrastructure.Persistence.Mapping;

public class MeetingStatusMapping : IEntityTypeConfiguration<MeetingStatus>

{
    public void Configure(EntityTypeBuilder<MeetingStatus> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Title).HasMaxLength(100).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(400);
        builder.HasMany(c => c.Meetings)
            .WithOne(e => e.Status)
            .HasForeignKey(e => e.StatusId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}