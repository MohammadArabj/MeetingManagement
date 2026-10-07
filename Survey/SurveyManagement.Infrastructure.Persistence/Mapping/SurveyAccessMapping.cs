using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SurveyManagement.Domain.SurveyAccessAgg;

namespace SurveyManagement.Infrastructure.Persistence.Mapping;

public class SurveyAccessMapping : IEntityTypeConfiguration<SurveyAccess>
{
    public void Configure(EntityTypeBuilder<SurveyAccess> builder)
    {
        builder.ToTable("SurveyAccess", "dbo");
        
        builder.HasKey(c => c.Id);
        
        // Indexes
        builder.HasIndex(c => c.Guid).IsUnique();
        builder.HasIndex(c => c.SurveyId);
        builder.HasIndex(c => new { c.TargetType, c.TargetGuid });
        builder.HasIndex(c => c.ExpirationDate);
        
        // Properties
        builder.Property(c => c.Guid)
            .IsRequired();
            
        builder.Property(c => c.SurveyId)
            .IsRequired();
            
        builder.Property(c => c.TargetType)
            .IsRequired();
            
        builder.Property(c => c.TargetGuid)
            .IsRequired(false);
            
        builder.Property(c => c.CanView)
            .IsRequired()
            .HasDefaultValue(false);
            
        builder.Property(c => c.CanRespond)
            .IsRequired()
            .HasDefaultValue(false);
            
        builder.Property(c => c.CanViewResults)
            .IsRequired()
            .HasDefaultValue(false);
            
        builder.Property(c => c.CanEdit)
            .IsRequired()
            .HasDefaultValue(false);
            
        builder.Property(c => c.CanDelete)
            .IsRequired()
            .HasDefaultValue(false);
            
        builder.Property(c => c.ExpirationDate)
            .IsRequired(false);
        
        // Relationship
        builder.HasOne(c => c.Survey)
            .WithMany(c => c.AccessControls)
            .HasForeignKey(c => c.SurveyId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
