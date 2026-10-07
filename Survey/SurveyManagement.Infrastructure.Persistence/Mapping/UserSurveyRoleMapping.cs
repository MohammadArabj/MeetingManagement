using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SurveyManagement.Domain.SurveyAccessAgg;

namespace SurveyManagement.Infrastructure.Persistence.Mapping;

public class UserSurveyRoleMapping : IEntityTypeConfiguration<UserSurveyRole>
{
    public void Configure(EntityTypeBuilder<UserSurveyRole> builder)
    {
        builder.ToTable("UserSurveyRoles", "dbo");
        
        builder.HasKey(c => c.Id);
        
        // Indexes
        builder.HasIndex(c => c.UserGuid);
        builder.HasIndex(c => c.RoleId);
        builder.HasIndex(c => new { c.UserGuid, c.RoleId }).IsUnique();
        
        // Properties
        builder.Property(c => c.UserGuid)
            .IsRequired();
            
        builder.Property(c => c.RoleId)
            .IsRequired();
            
        builder.Property(c => c.AssignedDate)
            .IsRequired();
            
        builder.Property(c => c.ExpirationDate)
            .IsRequired(false);
        
        // Relationship
        builder.HasOne(c => c.Role)
            .WithMany()
            .HasForeignKey(c => c.RoleId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
