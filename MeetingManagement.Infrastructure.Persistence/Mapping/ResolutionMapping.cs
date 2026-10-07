using MeetingManagement.Domain.ResolutionAgg;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MeetingManagement.Infrastructure.Persistence.Mapping;

public class ResolutionMapping:IEntityTypeConfiguration<Resolution>
{
    public void Configure(EntityTypeBuilder<Resolution> builder)
    {
        builder.ToTable("Resolutions");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Text).HasMaxLength(2000);
        builder.Property(x => x.Title).HasMaxLength(250).IsRequired(false);
        builder.Property(x => x.FileName).HasMaxLength(200);
        builder.HasOne(e => e.Meeting)
            .WithMany(e => e.Resolutions)
            .HasForeignKey(e => e.MeetingId);
    }
}