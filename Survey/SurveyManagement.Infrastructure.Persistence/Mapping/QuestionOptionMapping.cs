using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SurveyManagement.Domain.QuestionAgg;

namespace SurveyManagement.Infrastructure.Persistence.Mapping;

public class QuestionOptionMapping : IEntityTypeConfiguration<QuestionOption>
{
    public void Configure(EntityTypeBuilder<QuestionOption> builder)
    {
        builder.ToTable("QuestionOptions", "dbo");
        
        builder.HasKey(c => c.Id);
        
        // Indexes
        builder.HasIndex(c => c.Guid).IsUnique();
        builder.HasIndex(c => c.QuestionId);
        builder.HasIndex(c => c.SortOrder);
        
        // Properties
        builder.Property(c => c.Guid)
            .IsRequired();
            
        builder.Property(c => c.QuestionId)
            .IsRequired();
            
        builder.Property(c => c.OptionText)
            .HasMaxLength(1000)
            .IsRequired();
            
        builder.Property(c => c.SortOrder)
            .IsRequired();
            
            
        builder.Property(c => c.Color)
            .HasMaxLength(50)
            .IsRequired(false);
        
        // Relationship
        builder.HasOne(c => c.Question)
            .WithMany(c => c.Options)
            .HasForeignKey(c => c.QuestionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
