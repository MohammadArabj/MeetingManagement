using MeetingManagement.Domain.MeetingAgg;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MeetingManagement.Infrastructure.Persistence.Mapping;

public class AgendaMapping : IEntityTypeConfiguration<Agenda>
{
    public void Configure(EntityTypeBuilder<Agenda> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.File).HasMaxLength(250);
        builder.Property(x => x.Text).HasMaxLength(500);
        builder.Property(x => x.SortOrder);
        builder.Property(x => x.MeetingId);
        builder.Property(x => x.IsActive);
        builder.Property(x => x.Created);
        builder.Property(x => x.CreatedBy);
        builder.HasOne(e => e.Meeting)
            .WithMany(e => e.Agendas)
            .HasForeignKey(e => e.MeetingId);
    }
}