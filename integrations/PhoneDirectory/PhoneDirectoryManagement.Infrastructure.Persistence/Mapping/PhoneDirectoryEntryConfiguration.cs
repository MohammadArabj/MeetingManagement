// PhoneDirectoryManagement.Infrastructure/Persistence/Configuration/PhoneDirectoryConfigurations.cs
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PhoneDirectoryManagement.Domain.PhoneDirectoryAgg;

namespace PhoneDirectoryManagement.Infrastructure.Persistence.Mapping;

public class PhoneDirectoryEntryConfiguration : IEntityTypeConfiguration<PhoneDirectoryEntry>
{
    public void Configure(EntityTypeBuilder<PhoneDirectoryEntry> builder)
    {
        builder.ToTable("PhoneDirectoryEntries");

        builder.Property(x => x.LocationTitle).HasMaxLength(200);
        builder.Property(x => x.Description).HasMaxLength(500);
        builder.HasMany(x => x.Numbers)
               .WithOne(z=>z.PhoneDirectoryEntry)
               .HasForeignKey(x => x.PhoneDirectoryEntryId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(x => x.Numbers).AutoInclude();
    }
}
