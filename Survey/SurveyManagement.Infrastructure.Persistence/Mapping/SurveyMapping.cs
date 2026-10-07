using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SurveyManagement.Domain.SurveyAgg;

namespace SurveyManagement.Infrastructure.Persistence.Mapping;

public class SurveyMapping : IEntityTypeConfiguration<Survey>
{
    public void Configure(EntityTypeBuilder<Survey> builder)
    {
        builder.ToTable("Surveys", "dbo");
        
        // Primary Key
        builder.HasKey(c => c.Id);
        
        // Indexes
        builder.HasIndex(c => c.Guid).IsUnique();
        builder.HasIndex(c => c.Status);
        builder.HasIndex(c => c.CreatedBy);
        builder.HasIndex(c => new { c.StartDate, c.EndDate });
        
        // Properties
        builder.Property(c => c.Guid)
            .IsRequired();
            
        builder.Property(c => c.Title)
            .HasMaxLength(500)
            .IsRequired();
            
        builder.Property(c => c.Description)
            .HasMaxLength(4000)
            .IsRequired();
            
        builder.Property(c => c.StartDate)
            .IsRequired();
            
        builder.Property(c => c.EndDate)
            .IsRequired();
            
        builder.Property(c => c.Status)
            .IsRequired();
            
        builder.Property(c => c.AccessType)
            .IsRequired();
            
        builder.Property(c => c.AllowAnonymous)
            .IsRequired()
            .HasDefaultValue(false);
            
        builder.Property(c => c.AllowSaveDraft)
            .IsRequired()
            .HasDefaultValue(true);
            
        builder.Property(c => c.ShowProgressBar)
            .IsRequired()
            .HasDefaultValue(true);
            
        builder.Property(c => c.RandomizeQuestions)
            .IsRequired()
            .HasDefaultValue(false);
            
        builder.Property(c => c.AllowMultipleResponses)
            .IsRequired()
            .HasDefaultValue(false);
            
        builder.Property(c => c.WelcomeMessage)
            .HasMaxLength(2000)
            .IsRequired(false);
            
        builder.Property(c => c.ThankYouMessage)
            .HasMaxLength(2000)
            .IsRequired(false);
            
        builder.Property(c => c.MaxResponses)
            .IsRequired(false);
            
        builder.Property(c => c.TotalResponses)
            .IsRequired()
            .HasDefaultValue(0);
            
        builder.Property(c => c.RequireLogin)
            .IsRequired()
            .HasDefaultValue(true);
            
        builder.Property(c => c.Version)
            .IsRequired()
            .HasDefaultValue(1);
            
        builder.Property(c => c.PublishedDate)
            .IsRequired(false);
            
        builder.Property(c => c.PublishedBy)
            .IsRequired(false);
            
        builder.Property(c => c.ThemeColor)
            .HasMaxLength(50)
            .IsRequired(false);
            
        builder.Property(c => c.LogoGuid)
            .HasMaxLength(500)
            .IsRequired(false);
            
        builder.Property(c => c.BackgroundImageGuid)
            .HasMaxLength(500)
            .IsRequired(false);
        
        // Relationships
        builder.HasMany(c => c.Questions)
            .WithOne(c => c.Survey)
            .HasForeignKey(c => c.SurveyId)
            .OnDelete(DeleteBehavior.Cascade);
            
        builder.HasMany(c => c.Responses)
            .WithOne(c => c.Survey)
            .HasForeignKey(c => c.SurveyId)
            .OnDelete(DeleteBehavior.Cascade);
            
        builder.HasMany(c => c.AccessControls)
            .WithOne(c => c.Survey)
            .HasForeignKey(c => c.SurveyId)
            .OnDelete(DeleteBehavior.Cascade);
            
        builder.HasMany(c => c.ChangeLogs)
            .WithOne(c => c.Survey)
            .HasForeignKey(c => c.SurveyId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}


