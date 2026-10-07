using MeetingManagement.Domain.BoardMemberAgg;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MeetingManagement.Infrastructure.Persistence.Mapping;

public class BoardMemberMapping:IEntityTypeConfiguration<BoardMember>
{
    public void Configure(EntityTypeBuilder<BoardMember> builder)
    {
        builder.Property(x => x.FirstName).HasMaxLength(70).IsRequired();
        builder.Property(x => x.Mobile).HasMaxLength(11).IsRequired(false);
        builder.Property(x => x.LastName).HasMaxLength(70).IsRequired();
        builder.Property(x=>x.Company).HasMaxLength(200).IsRequired(false);
        builder.Property(x => x.Position).HasMaxLength(200).IsRequired(false);
        builder.Ignore(x => x.FullName);
        builder.HasMany(x => x.MeetingMembers)
            .WithOne(x => x.BoardMember)
            .HasForeignKey(x => x.BoardMemberId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}