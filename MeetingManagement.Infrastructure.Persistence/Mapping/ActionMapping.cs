using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MeetingManagement.Infrastructure.Persistence.Mapping;

public class ActionMapping:IEntityTypeConfiguration<Domain.ActionAgg.Action>
{


    public void Configure(EntityTypeBuilder<Domain.ActionAgg.Action> builder)
    {
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Description).HasMaxLength(400).IsRequired(false);

        builder.HasOne(c => c.Assignment)
            .WithMany(c => c.Actions)
            .HasForeignKey(c => c.AssignmentId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}