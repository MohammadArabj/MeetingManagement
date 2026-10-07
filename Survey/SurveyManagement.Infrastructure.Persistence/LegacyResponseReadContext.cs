using Microsoft.EntityFrameworkCore;
using SurveyManagement.Domain.ResponseAgg;

namespace SurveyManagement.Infrastructure.Persistence;

/// <summary>
/// DbContext موقت و مینیمال فقط برای خواندن ستون‌های قدیمی جدول Responses
/// قبل از این‌که Migration حذف آن ستون‌ها اجرا شود.
/// بعد از اتمام Migration دادهٔ قدیمی، این فایل قابل حذف است.
/// </summary>
public class LegacyResponseReadContext : DbContext
{
    public LegacyResponseReadContext(DbContextOptions<LegacyResponseReadContext> options)
        : base(options) { }

    public DbSet<LegacyResponseRow> LegacyResponses { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<LegacyResponseRow>(b =>
        {
            b.ToTable("Responses", "dbo");
            b.HasKey(x => x.Id);
            // فقط ستون‌های موردنیاز map می‌شوند؛ بقیهٔ ستون‌های جدول نادیده گرفته می‌شوند
            b.Property(x => x.Id);
            b.Property(x => x.Guid);
            b.Property(x => x.SurveyId);
            b.Property(x => x.RespondentUserGuid);
            b.Property(x => x.IsAnonymous);
            b.Property(x => x.Status);
            b.Property(x => x.StartedAt);
            b.Property(x => x.CompletedAt);
        });
    }
}