using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SurveyManagement.Domain.ResponseAgg;

namespace SurveyManagement.Infrastructure.Persistence.Mapping;

public class ResponseMapping : IEntityTypeConfiguration<Response>
{
    public void Configure(EntityTypeBuilder<Response> builder)
    {
        builder.ToTable("Responses", "dbo");

        // Primary Key
        builder.HasKey(c => c.Id);

        // Indexes
        builder.HasIndex(c => c.Guid).IsUnique();
        builder.HasIndex(c => c.SurveyId);
        builder.HasIndex(c => c.CompletedAt);

        builder.Property(c => c.Age).IsRequired(false);
        builder.Property(c => c.Gender).HasMaxLength(50).IsRequired(false);
        builder.Property(c => c.Office).HasMaxLength(200).IsRequired(false);
        builder.Property(c => c.EmploymentType).HasMaxLength(100).IsRequired(false);
        builder.Property(c => c.Education).HasMaxLength(100).IsRequired(false);
        builder.Property(c => c.ShiftWorker).HasMaxLength(50).IsRequired(false);
        builder.Property(c => c.ExperienceYears).IsRequired(false);
        builder.Property(c => c.OrganizationalGrade).HasMaxLength(50).IsRequired(false);
        builder.Property(c => c.OrganizationalGroup).HasMaxLength(100).IsRequired(false);

        builder.HasIndex(c => new { c.SurveyId, c.Gender });
        builder.HasIndex(c => new { c.SurveyId, c.Office });
        builder.HasIndex(c => new { c.SurveyId, c.EmploymentType });
        builder.HasIndex(c => new { c.SurveyId, c.Education });
        builder.HasIndex(c => new { c.SurveyId, c.ShiftWorker });
        builder.HasIndex(c => new { c.SurveyId, c.OrganizationalGrade });
        builder.HasIndex(c => new { c.SurveyId, c.OrganizationalGroup });

        // Properties
        builder.Property(c => c.Guid)
            .IsRequired();

        builder.Property(c => c.SurveyId)
            .IsRequired();

        builder.Property(c => c.StartedAt)
            .IsRequired();

        builder.Property(c => c.CompletedAt)
            .IsRequired(false);

        builder.Property(c => c.TimeSpentSeconds)
            .IsRequired(false);



        // Relationships
        builder.HasOne(c => c.Survey)
            .WithMany(c => c.Responses)
            .HasForeignKey(c => c.SurveyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(c => c.Answers)
            .WithOne(c => c.Response)
            .HasForeignKey(c => c.ResponseId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

