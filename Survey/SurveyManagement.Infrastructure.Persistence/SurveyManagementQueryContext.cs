using Epc.Logging;
using Microsoft.EntityFrameworkCore;
using SurveyManagement.Domain.ParticipantAgg;
using SurveyManagement.Domain.QuestionAgg;
using SurveyManagement.Domain.ResponseAgg;
using SurveyManagement.Domain.SurveyAccessAgg;
using SurveyManagement.Domain.SurveyAgg;
using SurveyManagement.Domain.SurveyCriterionAgg;
using SurveyManagement.Infrastructure.Persistence.Mapping;
using SurveyManagement.Infrastructure.Persistence.Views;
using System.Reflection.Emit;

namespace SurveyManagement.Infrastructure.Persistence;

public class SurveyManagementQueryContext : DbContext
{
    public SurveyManagementQueryContext(DbContextOptions<SurveyManagementQueryContext> options)
        : base(options)
    {
    }

    // Survey Aggregates
    public DbSet<Survey> Surveys { get; set; }
    public DbSet<SurveyChangeLog> SurveyChangeLogs { get; set; }
    
    // Question Aggregates
    public DbSet<Question> Questions { get; set; }
    public DbSet<QuestionOption> QuestionOptions { get; set; }
    public DbSet<QuestionLogic> QuestionLogics { get; set; }
    
    // Response Aggregates
    public DbSet<Response> Responses { get; set; }
    public DbSet<ResponseAnswer> ResponseAnswers { get; set; }
    
    // Access Control Aggregates
    public DbSet<SurveyAccess> SurveyAccess { get; set; }
    public DbSet<SurveySystemRole> SurveySystemRoles { get; set; }
    public DbSet<UserSurveyRole> UserSurveyRoles { get; set; }
    public DbSet<SurveyParticipant> SurveyParticipants { get; set; }

    // Operation Logs
    // public DbSet<OperationLog> OperationLogs { get; set; }
    public DbSet<PersonelInfoView> PersonelInfoViews { get; set; }
    public DbSet<SurveyCriterion> SurveyCriteria { get; set; }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        builder.HasDefaultSchema("dbo");
        
        // Apply all configurations from assembly
        var assembly = typeof(SurveyMapping).Assembly;
        builder.ApplyConfigurationsFromAssembly(assembly);
        builder.ApplyConfiguration(new PersonelInfoViewMapping());

        base.OnModelCreating(builder);
    }
}
