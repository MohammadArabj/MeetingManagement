using MeetingManagement.Domain.RoleAgg;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MeetingManagement.Infrastructure.Persistence.Mapping;

public class RoleMapping: IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> builder)
    {
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Title).HasMaxLength(100).IsRequired();
        builder.Property(c => c.Color).HasMaxLength(50).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(400);
        builder.HasMany(c => c.MeetingMembers)
            .WithOne(e => e.Role)
            .HasForeignKey(e => e.RoleId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}