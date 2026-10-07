using MeetingManagement.Domain.SettingAgg;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MeetingManagement.Infrastructure.Persistence.Mapping;

public class SystemSettingConfiguration : IEntityTypeConfiguration<SystemSetting>
{
    public void Configure(EntityTypeBuilder<SystemSetting> builder)
    {
        builder.ToTable("SystemSettings");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.Key)
            .IsRequired()
            .HasConversion<byte>();

        builder.Property(s => s.Value)
            .IsRequired()
            .HasMaxLength(1000);

        builder.Property(s => s.ValueType)
            .IsRequired()
            .HasConversion<byte>();

        builder.Property(s => s.Category)
            .IsRequired()
            .HasConversion<byte>();

        builder.Property(s => s.DisplayName)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(s => s.Description)
            .HasMaxLength(500);

        builder.HasIndex(s => s.Key)
            .IsUnique();

        builder.HasIndex(s => s.Category);
    }
}