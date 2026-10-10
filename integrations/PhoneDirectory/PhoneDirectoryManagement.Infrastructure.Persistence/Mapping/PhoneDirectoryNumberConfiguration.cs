// PhoneDirectoryManagement.Infrastructure/Persistence/Configuration/PhoneDirectoryConfigurations.cs
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PhoneDirectoryManagement.Domain.PhoneDirectoryAgg;

namespace PhoneDirectoryManagement.Infrastructure.Persistence.Mapping;

public class PhoneDirectoryNumberConfiguration : IEntityTypeConfiguration<PhoneDirectoryNumber>
{
    public void Configure(EntityTypeBuilder<PhoneDirectoryNumber> builder)
    {
        builder.ToTable("PhoneDirectoryNumbers");
        builder.Property(x => x.Number).IsRequired().HasMaxLength(20);
    }
}