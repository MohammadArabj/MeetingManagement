using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SurveyManagement.Domain.SurveyAccessAgg;

namespace SurveyManagement.Infrastructure.Persistence.Mapping;

public class SurveySystemRoleMapping : IEntityTypeConfiguration<SurveySystemRole>
{
    public void Configure(EntityTypeBuilder<SurveySystemRole> builder)
    {
        builder.ToTable("SurveySystemRoles", "dbo");
        
        builder.HasKey(c => c.Id);
        
        // Indexes
        builder.HasIndex(c => c.Guid).IsUnique();
        builder.HasIndex(c => c.RoleName).IsUnique();
        builder.HasIndex(c => c.RoleType);
        
        // Properties
        builder.Property(c => c.Guid)
            .IsRequired();
            
        builder.Property(c => c.RoleName)
            .HasMaxLength(100)
            .IsRequired();
            
        builder.Property(c => c.Description)
            .HasMaxLength(500)
            .IsRequired(false);
            
        builder.Property(c => c.RoleType)
            .IsRequired();
            
        builder.Property(c => c.IsSystemRole)
            .IsRequired()
            .HasDefaultValue(false);
    }
}
