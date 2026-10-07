using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SurveyManagement.Domain.QuestionAgg;

namespace SurveyManagement.Infrastructure.Persistence.Mapping;

public class QuestionLogicMapping : IEntityTypeConfiguration<QuestionLogic>
{
    public void Configure(EntityTypeBuilder<QuestionLogic> builder)
    {
        builder.ToTable("QuestionLogics", "dbo");
        
        builder.HasKey(c => c.Id);
        
        // Indexes
        builder.HasIndex(c => c.Guid).IsUnique();
        builder.HasIndex(c => c.SourceQuestionId);
        builder.HasIndex(c => c.TargetQuestionId);
        builder.HasIndex(c => c.Priority);
        
        // Properties
        builder.Property(c => c.Guid)
            .IsRequired();
            
        builder.Property(c => c.SourceQuestionId)
            .IsRequired();
            
        builder.Property(c => c.TargetQuestionId)
            .IsRequired(false);
            
        builder.Property(c => c.LogicType)
            .IsRequired();
            
        builder.Property(c => c.ConditionOperator)
            .IsRequired();
            
        builder.Property(c => c.ConditionValue)
            .HasColumnType("nvarchar(max)")
            .IsRequired(false);
            
        builder.Property(c => c.OptionId)
            .IsRequired(false);
            
        builder.Property(c => c.Priority)
            .IsRequired()
            .HasDefaultValue(1);
        
        // Relationships
        builder.HasOne(c => c.SourceQuestion)
            .WithMany(c => c.QuestionLogics)
            .HasForeignKey(c => c.SourceQuestionId)
            .OnDelete(DeleteBehavior.NoAction);
            
        builder.HasOne(c => c.TargetQuestion)
            .WithMany()
            .HasForeignKey(c => c.TargetQuestionId)
            .OnDelete(DeleteBehavior.NoAction);
            
        builder.HasOne(c => c.Option)
            .WithMany()
            .HasForeignKey(c => c.OptionId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}
