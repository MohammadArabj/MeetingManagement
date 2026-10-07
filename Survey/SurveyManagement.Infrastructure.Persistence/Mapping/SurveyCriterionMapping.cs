using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SurveyManagement.Domain.SurveyCriterionAgg;

namespace SurveyManagement.Infrastructure.Persistence.Mapping;


public class SurveyCriterionMapping : IEntityTypeConfiguration<SurveyCriterion>
{
    public void Configure(EntityTypeBuilder<SurveyCriterion> builder)
    {
        builder.ToTable("SurveyCriteria");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Guid).IsRequired();
        builder.HasIndex(x => x.Guid).IsUnique();

        builder.Property(x => x.Title).IsRequired().HasMaxLength(300);
        builder.Property(x => x.Description).HasMaxLength(1000);

        builder.HasOne(x => x.Survey)
            .WithMany(x=>x.Criteria) // اگر روی Survey یک ICollection<SurveyCriterion> اضافه کردید، اینجا .WithMany(s => s.Criteria)
            .HasForeignKey(x => x.SurveyId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}