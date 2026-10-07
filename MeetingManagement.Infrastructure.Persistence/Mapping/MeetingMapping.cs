using MeetingManagement.Domain.MeetingAgg;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MeetingManagement.Infrastructure.Persistence.Mapping;

public class MeetingMapping : IEntityTypeConfiguration<Meeting>
{
    public void Configure(EntityTypeBuilder<Meeting> builder)
    {
        #region Properties
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Number).HasMaxLength(20).IsRequired();
        builder.Property(x => x.Title).HasMaxLength(200);
        builder.Property(x => x.Rider).HasMaxLength(1000);
        builder.Property(x => x.Description).HasMaxLength(2000);
        builder.Property(x => x.RoomLink).HasMaxLength(200);
        builder.Property(x => x.RoomName).HasMaxLength(100);
        builder.Property(x => x.Summary).HasMaxLength(400);
        builder.Property(x => x.EndDate).HasColumnType("date");
        builder.Property(c => c.NotAllowReplacement).HasDefaultValue(true);
       // builder.Ignore(x => x.EventAggregator);


        #endregion


        #region Relations
        builder.HasMany(e => e.Resolutions)
            .WithOne(e => e.Meeting)
            .HasForeignKey(e => e.MeetingId);
        builder.HasOne(c => c.Category)
            .WithMany(c => c.Meetings)
            .HasForeignKey(c => c.CategoryId);
        builder.HasOne(c => c.Room)
            .WithMany(c => c.Meetings)
            .HasForeignKey(c => c.RoomId);
        builder.HasMany(c => c.Agendas)
            .WithOne(c => c.Meeting)
            .HasForeignKey(c => c.MeetingId);
        builder.HasMany(c => c.MeetingMembers)
            .WithOne(c => c.Meeting)
            .HasForeignKey(c => c.MeetingId);
        #endregion

    }
}