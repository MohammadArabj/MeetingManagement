using EPC.SSO.Quickstart.Grants;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Caching.Memory;
using System.Data;
using System.Diagnostics;

namespace EPC.SSO.Services;

public class WindowsProgramService(
    IConfiguration configuration,
    IMemoryCache memoryCache,
    EPC.SSO.Infrastructure.IAppCache cache,
    ILogger<WindowsProgramService> logger)
{
    private readonly string _connStr =
        configuration.GetConnectionString("Portal")
        ?? throw new InvalidOperationException("ConnectionStrings:Portal تعریف نشده.");

    /// <summary>برنامه‌های ویندوزی مجاز کاربر: ۳۰ دقیقه تازه، تا ۱۲ ساعت پشتیبان؛ به‌روزرسانی در پس‌زمینه</summary>
    public async Task<List<WindowsAppViewModel>> GetAccessibleAppsAsync(string personnelCode)
    {
        if (string.IsNullOrWhiteSpace(personnelCode)) return [];
        return await cache.GetOrCreateAsync($"winapps_list_{personnelCode}",
                   async _ => (List<WindowsAppViewModel>?)await LoadAccessibleAppsAsync(personnelCode),
                   TimeSpan.FromMinutes(30), TimeSpan.FromHours(12)) ?? [];
    }

    private async Task<List<WindowsAppViewModel>> LoadAccessibleAppsAsync(string personnelCode)
    {
        const string sql = """
            DECLARE @StrProcBox NVARCHAR(MAX), @PersonalCode NVARCHAR(20);

            SELECT TOP 1
                   @StrProcBox = StrProcBox,
                   @PersonalCode = CAST(Personeli_Number AS NVARCHAR(20))
            FROM [Portal].[dbo].[SYSTEM21]
            WHERE Personeli_Number = @PersonnelCode;

            IF @StrProcBox IS NOT NULL AND LEN(@StrProcBox) > 0
            BEGIN
                ;WITH Numbers AS (
                    SELECT TOP (LEN(@StrProcBox))
                           ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n
                    FROM sys.all_objects
                )
                SELECT h.PK_PrgListHdr,
                       ISNULL(h.PrgName, N'بدون نام') AS PrgName,
                       ISNULL(h.PrgDesc, N'')         AS PrgDesc,
                       ISNULL(h.Priority, 0)          AS Priority,
                       @PersonalCode                  AS PersonalCode
                FROM Numbers nu
                JOIN [Portal].[dbo].[PrgListHdr] h ON h.PK_PrgListHdr = nu.n
                WHERE SUBSTRING(@StrProcBox, nu.n, 1) = '1'
                ORDER BY ISNULL(h.Priority, 0) DESC;
            END
            """;

        var apps = new List<WindowsAppViewModel>();
        var sw = Stopwatch.StartNew();

        await using var conn = new SqlConnection(_connStr);
        await conn.OpenAsync();
        var ss = sw.ElapsedMilliseconds;
        logger.LogInformation("[WindowsApps] SqlConnection.OpenAsync در {Ms}ms", sw.ElapsedMilliseconds);

        var swQuery = Stopwatch.StartNew();
        await using var cmd = new SqlCommand(sql, conn) { CommandTimeout = 15 };
        cmd.Parameters.Add("@PersonnelCode", SqlDbType.NVarChar, 50).Value = personnelCode;

        await using var reader = await cmd.ExecuteReaderAsync(CommandBehavior.SequentialAccess);
        logger.LogInformation("[WindowsApps] ExecuteReaderAsync (اجرای Query) در {Ms}ms", swQuery.ElapsedMilliseconds);

        var swRead = Stopwatch.StartNew();
        while (await reader.ReadAsync())
        {
            var id = reader.GetInt32(0);
            var name = reader.GetString(1);
            var description = reader.GetString(2);
            var personalCode = reader.GetString(4);

            apps.Add(new WindowsAppViewModel
            {
                Id = id,
                Name = name,
                Description = description,
                IconBase64 = null,
                LaunchUrl = $"portalapp://launch/{id}/{personalCode}"
            });
        }
        logger.LogInformation("[WindowsApps] خواندن {Count} ردیف در {Ms}ms — کل SQL: {Total}ms",
            apps.Count, swRead.ElapsedMilliseconds, sw.ElapsedMilliseconds);

        return apps;
    }

    public async Task<(byte[]? Bytes, string ContentType)> GetIconAsync(int programId)
    {
        var cacheKey = $"winapp_icon_{programId}";
        if (memoryCache.TryGetValue(cacheKey, out (byte[]? Bytes, string ContentType) cached))
            return cached;

        const string sql = """
            SELECT PrgPic FROM [Portal].[dbo].[PrgListHdr]
            WHERE PK_PrgListHdr = @Id
            """;

        byte[]? bytes = null;

        await using (var conn = new SqlConnection(_connStr))
        {
            await conn.OpenAsync();
            await using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.Add("@Id", SqlDbType.Int).Value = programId;
            bytes = await cmd.ExecuteScalarAsync() as byte[];
        }

        var icon = (bytes, "image/png");

        memoryCache.Set(cacheKey, icon, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(12),
            Size = 1
        });

        return icon;
    }
}