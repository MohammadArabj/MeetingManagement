using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SurveyManagement.Domain.QuestionAgg;

namespace SurveyManagement.Infrastructure.Persistence.Mapping;

public class QuestionMapping : IEntityTypeConfiguration<Question>
{
    public void Configure(EntityTypeBuilder<Question> builder)
    {
        builder.ToTable("Questions", "dbo");
        
        // Primary Key
        builder.HasKey(c => c.Id);
        
        // Indexes
        builder.HasIndex(c => c.Guid).IsUnique();
        builder.HasIndex(c => c.SurveyId);
        builder.HasIndex(c => c.SortOrder);
        
        // Properties
        builder.Property(c => c.Guid)
            .IsRequired();
            
        builder.Property(c => c.SurveyId)
            .IsRequired();
            
        builder.Property(c => c.QuestionText)
            .HasColumnType("nvarchar(max)")
            .IsRequired();
            
        builder.Property(c => c.QuestionType)
            .IsRequired();
            
        builder.Property(c => c.SortOrder)
            .IsRequired();
            
        builder.Property(c => c.IsRequired)
            .IsRequired()
            .HasDefaultValue(false);
            
        builder.Property(c => c.HelpText)
            .HasMaxLength(1000)
            .IsRequired(false);
            
        builder.Property(c => c.Placeholder)
            .HasMaxLength(200)
            .IsRequired(false);
            
        builder.Property(c => c.RandomizeOptions)
            .IsRequired()
            .HasDefaultValue(false);
            
        builder.Property(c => c.AllowOtherOption)
            .IsRequired()
            .HasDefaultValue(false);
            
        builder.Property(c => c.OtherOptionText)
            .HasMaxLength(200)
            .IsRequired(false);
            
        builder.Property(c => c.ImageUrl)
            .HasMaxLength(500)
            .IsRequired(false);
            
        builder.Property(c => c.VideoUrl)
            .HasMaxLength(500)
            .IsRequired(false);

        builder.Property(c => c.ValidationType)
            .IsRequired();
            
        builder.Property(c => c.ValidationErrorMessage)
            .HasMaxLength(500)
            .IsRequired(false);
            
        builder.Property(c => c.CustomValidationRegex)
            .HasMaxLength(500)
            .IsRequired(false);
            
        builder.Property(c => c.MinLength)
            .IsRequired(false);
            
        builder.Property(c => c.MaxLength)
            .IsRequired(false);
            
        builder.Property(c => c.MinValue)
            .HasColumnType("decimal(18,2)")
            .IsRequired(false);
            
        builder.Property(c => c.MaxValue)
            .HasColumnType("decimal(18,2)")
            .IsRequired(false);
            
        builder.Property(c => c.MinSelections)
            .IsRequired(false);
            
        builder.Property(c => c.MaxSelections)
            .IsRequired(false);
            
        builder.Property(c => c.MaxFileSize)
            .IsRequired(false);
            
        builder.Property(c => c.AllowedFileTypes)
            .HasMaxLength(500)
            .IsRequired(false);
            
        builder.Property(c => c.MinScaleLabel)
            .HasMaxLength(100)
            .IsRequired(false);
            
        builder.Property(c => c.MaxScaleLabel)
            .HasMaxLength(100)
            .IsRequired(false);
            
        builder.Property(c => c.MatrixRows)
            .HasColumnType("nvarchar(max)")
            .IsRequired(false);
            
        builder.Property(c => c.MatrixColumns)
            .HasColumnType("nvarchar(max)")
            .IsRequired(false);
        
        // Relationships
        builder.HasOne(c => c.Survey)
            .WithMany(c => c.Questions)
            .HasForeignKey(c => c.SurveyId)
            .OnDelete(DeleteBehavior.Cascade);
            
        builder.HasMany(c => c.Options)
            .WithOne(c => c.Question)
            .HasForeignKey(c => c.QuestionId)
            .OnDelete(DeleteBehavior.Cascade);
            
        builder.HasMany(c => c.QuestionLogics)
            .WithOne(c => c.SourceQuestion)
            .HasForeignKey(c => c.SourceQuestionId)
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(x => x.Criterion)
            .WithMany(c => c.Questions)
            .HasForeignKey(x => x.CriterionId)
            .OnDelete(DeleteBehavior.SetNull);
            }
}
