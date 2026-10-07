using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SurveyManagement.Domain.ParticipantAgg;
using SurveyManagement.Domain.QuestionAgg;
using System;
using System.Collections.Generic;
using System.Text;

namespace SurveyManagement.Infrastructure.Persistence.Mapping
{

    public class SurveyParticipantMapping : IEntityTypeConfiguration<SurveyParticipant>
    {
        public void Configure(EntityTypeBuilder<SurveyParticipant> builder)
        {
            builder.ToTable("SurveyParticipants", "dbo");

            // Primary Key
            builder.HasKey(c => new { c.SurveyId, c.UserGuid });

            // Indexes
            builder.HasIndex(c => c.SurveyId);

            // Properties
            builder.Property(c => c.SurveyId)
                .IsRequired();

            builder.Property(c => c.UserGuid)
                .IsRequired();

            builder.Property(c => c.ParticipatedAt)
                .IsRequired();

        }
    }

}
