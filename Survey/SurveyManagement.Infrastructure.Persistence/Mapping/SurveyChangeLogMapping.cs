using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SurveyManagement.Domain.SurveyAgg;

namespace SurveyManagement.Infrastructure.Persistence.Mapping;

public class SurveyChangeLogMapping : IEntityTypeConfiguration<SurveyChangeLog>
{
    public void Configure(EntityTypeBuilder<SurveyChangeLog> builder)
    {
        builder.ToTable("SurveyChangeLogs", "dbo");
        
        builder.HasKey(c => c.Id);
        
        // Indexes
        builder.HasIndex(c => c.SurveyId);
        builder.HasIndex(c => c.ChangeDate);
        builder.HasIndex(c => c.Version);
        
        // Properties
        builder.Property(c => c.SurveyId)
            .IsRequired();
            
        builder.Property(c => c.ChangeType)
            .IsRequired();
            
        builder.Property(c => c.Description)
            .HasMaxLength(500)
            .IsRequired(false);
            
        builder.Property(c => c.Version)
            .IsRequired();
            
        builder.Property(c => c.ChangeDate)
            .IsRequired();
            
        builder.Property(c => c.BeforeSnapshot)
            .HasColumnType("nvarchar(max)")
            .IsRequired(false);
            
        builder.Property(c => c.AfterSnapshot)
            .HasColumnType("nvarchar(max)")
            .IsRequired(false);
        
        // Relationship
        builder.HasOne(c => c.Survey)
            .WithMany(c => c.ChangeLogs)
            .HasForeignKey(c => c.SurveyId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
