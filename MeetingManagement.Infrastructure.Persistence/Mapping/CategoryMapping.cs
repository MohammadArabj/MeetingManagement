using MeetingManagement.Domain.CategoryAgg;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MeetingManagement.Infrastructure.Persistence.Mapping;

public class CategoryMapping:IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Title).HasMaxLength(250).IsRequired();
        builder.Property(x => x.Title).HasMaxLength(50).IsRequired();
        builder.Property(x => x.IsActive);
        builder.Property(x => x.Guid);
        builder.Property(x => x.IsRemoved);
        builder.Property(x => x.IsLocked);
        builder.Property(x => x.Created);
        builder.Property(x => x.CreatedBy);
        builder.Property(x => x.LastModified);
        builder.Property(x => x.LastModifiedBy);
        builder.Ignore(x => x.EventAggregator);
        builder.HasMany(e => e.Meetings)
            .WithOne(e => e.Category)
            .HasForeignKey(e => e.CategoryId);
    }
}