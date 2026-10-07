using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using System.Diagnostics;

namespace EPC.SSO.Services;

public class TopSuggesterDto
{
    public int SuggestionCount { get; set; }
    public int FK_PersonInit { get; set; }
    public string? LfName { get; set; }
    public string? OfficeName { get; set; }
    public string? ImageUrl { get; set; }
}

public class SuggestionService(
    IConfiguration configuration,
    EPC.SSO.Infrastructure.IAppCache cache,
    ILogger<SuggestionService> logger)
{
    private readonly string _connectionString =
        configuration.GetConnectionString("SuggestionSystem")
        ?? throw new InvalidOperationException("SuggestionSystem connection string is missing.");

    // آدرس پایه‌ی تصاویر پرسنل — قابل تنظیم در appsettings.json
    // مثال: "SuggestionSystem": { "AvatarBaseUrl": "http://localhost:4200" }
    private readonly string _avatarBaseUrl =
        configuration["ExternalApis:FileManagementApi:BaseUrl"]?.TrimEnd('/')
        ?? throw new InvalidOperationException("SuggestionSystem:AvatarBaseUrl تعریف نشده.");

    /// <summary>
    /// برترین پیشنهاددهندگان (برای همه‌ی کاربران یکسان). Query سنگین است؛ پس داده ۱۵ دقیقه تازه و تا ۱۲ ساعت
    /// به‌عنوان پشتیبان نگه داشته می‌شود و به‌روزرسانی در پس‌زمینه انجام می‌شود (کاربر هرگز منتظر Query نمی‌ماند،
    /// جز اولین بار که سرویس پس‌زمینه‌ی گرم‌کردن هم آن را از قبل پر می‌کند). خطا دیگر «لیست خالی» کش نمی‌شود.
    /// </summary>
    public async Task<List<TopSuggesterDto>> GetTopSuggestionsAsync(int count)
        => await cache.GetOrCreateAsync($"top_suggesters_{count}", _ => LoadTopSuggestionsAsync(count),
               TimeSpan.FromMinutes(15), TimeSpan.FromHours(12)) ?? [];

    private async Task<List<TopSuggesterDto>?> LoadTopSuggestionsAsync(int count)
    {
        // ✅ سال شمسی جاری یک‌بار در متغیر محاسبه می‌شود؛ قبلاً dbo.shamsidate(GETDATE())
        // داخل WHERE بود که چون در دل یک اسکالر UDF پیچیده شده بود، بهینه‌ساز
        // SQL Server نمی‌توانست آن را ثابت در نظر بگیرد و به ازای هر ردیف
        // اسکن‌شده‌ی FlowComm دوباره محاسبه‌اش می‌کرد.
        const string sql = @"
DECLARE @CurrentShamsiYear CHAR(4) = SUBSTRING(dbo.shamsidate(GETDATE()), 1, 4);

SELECT TOP (@Count)
       COUNT(PK_DocHdr)                                                         AS SuggestionCount,
       FK_PersonInit,
       (SELECT FName + ' ' + LName FROM TblPerson WHERE PersNo = FK_PersonInit)  AS LfName,
       (SELECT EdarehDesc FROM ProperView WHERE PersNo = FK_PersonInit)          AS OfficeName
FROM DocHdr
WHERE PK_DocHdr IN (
        SELECT FK_DocHdr FROM FlowComm
        WHERE FK_ProcBox2 = 20
          AND SUBSTRING(CommDate, 1, 4) = @CurrentShamsiYear
      )
  AND FK_ProcDoreh IN (SELECT Pk_ProcDorehhdr FROM FlwProcessDorehHdr WHERE Fk_Application = 2)
  AND FK_PersonInit <> 0
  AND FK_PersonInit IN (SELECT PersNo FROM TblPerson WHERE Active = 1)
GROUP BY FK_PersonInit
HAVING COUNT(PK_DocHdr) >= 2
ORDER BY COUNT(PK_DocHdr) DESC;";

        var sw = Stopwatch.StartNew();
        List<TopSuggesterDto> result;

        try
        {
            await using var conn = new SqlConnection(_connectionString);
            await conn.OpenAsync();
            logger.LogInformation("[Suggestions] SqlConnection.OpenAsync در {Ms}ms", sw.ElapsedMilliseconds);

            var swQuery = Stopwatch.StartNew();
            var rows = await conn.QueryAsync<TopSuggesterDto>(new CommandDefinition(sql, new { Count = count }, commandTimeout: 60));
            result = rows.ToList();
            logger.LogInformation("[Suggestions] اجرای Query (Dapper) در {Ms}ms — {Count} ردیف",
                swQuery.ElapsedMilliseconds, result.Count);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[Suggestions] خطا در اجرای Query برای Count={Count}", count);
            return null; // null = خطا؛ نسخه‌ی قبلی کش حفظ می‌شود
        }

        // ✅ ساخت آدرس تصویر بر اساس کد پرسنلی — نیازی به کوئری یا API اضافه نیست
        foreach (var r in result)
            r.ImageUrl = $"{_avatarBaseUrl}/{r.FK_PersonInit}.jpg";

        logger.LogInformation("[Suggestions] کل SQL + پردازش در {Ms}ms", sw.ElapsedMilliseconds);

        return result;
    }
}