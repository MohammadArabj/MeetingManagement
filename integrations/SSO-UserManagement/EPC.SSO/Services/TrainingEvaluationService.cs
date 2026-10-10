using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Caching.Memory;
using System.Data;

namespace EPC.SSO.Services;

/// <summary>
/// تعداد ارزیابی‌های تکمیل‌نشده‌ی کاربر در «سامانه فراگیر آموزش» (پایگاه داده‌ی IdeaDB).
/// ─────────────────────────────────────────────────────────────────────────
/// • کوئری: <c>SELECT dbo.getEvalCount(@PersonnelCode)</c> — پارامتری (بدون الحاق رشته، ایمن در برابر SQL Injection).
/// • هرگز ورود یا داشبورد را کند/خراب نمی‌کند: اتصال و اجرا حداکثر چند ثانیه، و هر خطا = «۰» (پیغامی نمایش داده نمی‌شود).
/// • نتیجه برای هر کاربر چند دقیقه کش می‌شود (رفرش‌های پیاپی داشبورد به IdeaDB درخواست نمی‌زنند).
/// • اگر ConnectionStrings:Training یا TrainingEvaluation:Enabled=false تنظیم نشده باشد، قابلیت خاموش است.
/// </summary>
public class TrainingEvaluationService(
    IConfiguration configuration,
    IMemoryCache cache,
    ILogger<TrainingEvaluationService> logger)
{
    private static readonly TimeSpan CacheFor = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan FailureCacheFor = TimeSpan.FromMinutes(1);

    public bool Enabled =>
        configuration.GetValue("TrainingEvaluation:Enabled", true)
        && !string.IsNullOrWhiteSpace(configuration.GetConnectionString("Training"));

    /// <summary>
    /// شناسه‌ی «سامانه فراگیر آموزش» در جدول سایر برنامه‌ها (OtherPrograms، پیش‌فرض ۲۲).
    /// لینک ورود (همراه بلیط SSO) هنگام کلیک با OtherProgramService.PrepareLaunchAsync ساخته می‌شود.
    /// </summary>
    public int OtherProgramId => configuration.GetValue("TrainingEvaluation:OtherProgramId", 22);

    public async Task<int> GetPendingCountAsync(string? personnelCode, CancellationToken ct = default)
    {
        personnelCode = personnelCode?.Trim();
        if (!Enabled || string.IsNullOrEmpty(personnelCode) || personnelCode == "0" || personnelCode.Length > 20)
            return 0;

        var key = $"training-eval:{personnelCode}";
        if (cache.TryGetValue(key, out int cached)) return cached;

        int count;
        var cacheFor = CacheFor;
        try
        {
            count = await LoadAsync(personnelCode, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            // IdeaDB در دسترس نیست: پیغامی نمایش داده نمی‌شود و کمی بعد دوباره امتحان می‌شود
            logger.LogWarning(ex, "[TrainingEvaluation] خواندن تعداد ارزیابی‌ها برای {PersonnelCode} انجام نشد", personnelCode);
            count = 0;
            cacheFor = FailureCacheFor;
        }

        cache.Set(key, count, new MemoryCacheEntryOptions { AbsoluteExpirationRelativeToNow = cacheFor, Size = 1 });
        return count;
    }

    private async Task<int> LoadAsync(string personnelCode, CancellationToken ct)
    {
        var builder = new SqlConnectionStringBuilder(configuration.GetConnectionString("Training"));
        if (builder.ConnectTimeout > 5) builder.ConnectTimeout = 5;

        await using var conn = new SqlConnection(builder.ConnectionString);
        await conn.OpenAsync(ct);
        await using var cmd = new SqlCommand("SELECT dbo.getEvalCount(@PersonnelCode) AS countp", conn) { CommandTimeout = 5 };
        cmd.Parameters.Add("@PersonnelCode", SqlDbType.NVarChar, 20).Value = personnelCode;

        var value = await cmd.ExecuteScalarAsync(ct);
        return value is null or DBNull ? 0 : Math.Max(0, Convert.ToInt32(value));
    }
}
