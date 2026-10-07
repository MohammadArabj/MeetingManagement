using MeetingManagement.Domain.MeetingAgg;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MeetingManagement.Infrastructure.Persistence.Mapping;

public class MeetingMemberMapping:IEntityTypeConfiguration<MeetingMember>
{
    public void Configure(EntityTypeBuilder<MeetingMember> builder)
    {
        #region Properties
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).HasMaxLength(250).IsRequired(false);
        builder.Property(x => x.Mobile).HasMaxLength(11);
        builder.Property(x => x.Email).HasMaxLength(100);
        builder.Property(x => x.Organization).HasMaxLength(200);
        builder.Property(x => x.Comment).HasMaxLength(400);
        #endregion


        #region Relations
        builder.HasOne(c => c.Meeting)
            .WithMany(c => c.MeetingMembers)
            .HasForeignKey(c => c.MeetingId);
        #endregion

    }
}