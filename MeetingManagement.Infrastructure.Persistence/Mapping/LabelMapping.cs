using MeetingManagement.Domain.LabelAgg;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MeetingManagement.Infrastructure.Persistence.Mapping;

public class LabelMapping : IEntityTypeConfiguration<Label>
{
    public void Configure(EntityTypeBuilder<Label> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Title).HasMaxLength(100).IsRequired();
        builder.Property(x => x.Color).HasMaxLength(50).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(400);
        builder.HasMany(c => c.Resolutions)
                .WithOne(e => e.Label)
            .HasForeignKey(e => e.LabelId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}