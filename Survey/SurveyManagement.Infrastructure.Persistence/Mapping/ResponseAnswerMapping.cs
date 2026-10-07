using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SurveyManagement.Domain.ResponseAgg;

namespace SurveyManagement.Infrastructure.Persistence.Mapping;

public class ResponseAnswerMapping : IEntityTypeConfiguration<ResponseAnswer>
{
    public void Configure(EntityTypeBuilder<ResponseAnswer> builder)
    {
        builder.ToTable("ResponseAnswers", "dbo");
        
        builder.HasKey(c => c.Id);
        
        // Indexes
        builder.HasIndex(c => c.Guid).IsUnique();
        builder.HasIndex(c => c.ResponseId);
        builder.HasIndex(c => c.QuestionId);
        builder.HasIndex(c => c.QuestionType);
        builder.HasIndex(c => new { c.ResponseId, c.QuestionId }); // برای جستجوی سریع‌تر
        
        // Properties
        builder.Property(c => c.Guid)
            .IsRequired();
            
        builder.Property(c => c.ResponseId)
            .IsRequired();
            
        builder.Property(c => c.QuestionId)
            .IsRequired();
            
        builder.Property(c => c.QuestionType)
            .IsRequired();
            
        builder.Property(c => c.TextAnswer)
            .HasColumnType("nvarchar(max)")
            .IsRequired(false);
            
        builder.Property(c => c.NumericAnswer)
            .HasColumnType("decimal(18,2)")
            .IsRequired(false);
            
        builder.Property(c => c.DateAnswer)
            .IsRequired(false);
            
        builder.Property(c => c.SelectedOptionId)
            .IsRequired(false);
            
        builder.Property(c => c.SelectedOptionIds)
            .HasColumnType("nvarchar(max)")
            .IsRequired(false);
            
        builder.Property(c => c.OtherAnswer)
            .HasColumnType("nvarchar(max)")
            .IsRequired(false);
            
        builder.Property(c => c.FileUrl)
            .HasMaxLength(500)
            .IsRequired(false);
            
        builder.Property(c => c.FileName)
            .HasMaxLength(500)
            .IsRequired(false);
            
        builder.Property(c => c.FileSize)
            .IsRequired(false);
            
        builder.Property(c => c.MatrixAnswers)
            .HasColumnType("nvarchar(max)")
            .IsRequired(false);
            
        builder.Property(c => c.RankingAnswers)
            .HasColumnType("nvarchar(max)")
            .IsRequired(false);
            
        builder.Property(c => c.AnsweredAt)
            .IsRequired();
            
        builder.Property(c => c.TimeSpentSeconds)
            .IsRequired(false);
            
        builder.Property(c => c.IsSkipped)
            .IsRequired()
            .HasDefaultValue(false);
        
        // Relationships
        builder.HasOne(c => c.Response)
            .WithMany(c => c.Answers)
            .HasForeignKey(c => c.ResponseId)
            .OnDelete(DeleteBehavior.Cascade);
            
        builder.HasOne(c => c.Question)
            .WithMany()
            .HasForeignKey(c => c.QuestionId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}
