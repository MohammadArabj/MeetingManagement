namespace SurveyManagement.Presentation.Api.Services;

using global::SurveyManagement.Domain.ParticipantAgg;
using global::SurveyManagement.Domain.Shared.Acls.UserManagement;
using global::SurveyManagement.Infrastructure.Persistence;
using global::SurveyManagement.Infrastructure.Persistence.Views;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
public interface ILegacyResponseDemographicMigrationService
{
    Task<MigrationResult> RunAsync();
}

public class MigrationResult
{
    public int TotalLegacyResponses { get; set; }
    public int CompletedMigrated { get; set; }
    public int DraftDeleted { get; set; }
    public int AnonymousSkipped { get; set; }
    public int UserLookupFailed { get; set; }
    public int PersonelInfoNotFound { get; set; }
    public int ParticipantsCreated { get; set; }
    public List<string> Errors { get; set; } = new();
}

/// <summary>
/// ✅ سرویس یک‌بارمصرف: تبدیل داده‌های قدیمی Response (سبک هویت‌محور) به سبک جدید (دموگرافیک ناشناس)
///
/// اجرا فقط یک بار، قبل از Migration حذف ستون‌های قدیمی (RespondentUserGuid, IsAnonymous, Status و...)
///
/// مراحل:
/// 1) خواندن تمام ردیف‌های خام قدیمی از LegacyResponseReadContext
/// 2) برای هر UserGuid یکتا: یک بار GetUserByAsync (کش‌شده) → PersonnelCode
/// 3) با PersonnelCode: خواندن دموگرافیک از vwPersonelInfo (روی همین سرور SurveyManagement)
/// 4) نوشتن دموگرافیک روی Response جدید + ساخت SurveyParticipant
/// 5) حذف پاسخ‌های Draft/InProgress (چون سیستم جدید ازشان پشتیبانی نمی‌کند)
/// </summary>
public class LegacyResponseDemographicMigrationService : ILegacyResponseDemographicMigrationService
{
    private const int BatchSize = 200;
    private const int LegacyStatusCompleted = 2; // ⚠️ مقدار enum قدیمی خودتان را اینجا تأیید/اصلاح کنید

    private readonly LegacyResponseReadContext _legacyContext;
    private readonly SurveyManagementQueryContext _queryContext; // برای خواندن SurveyId ها و چک وضعیت فعلی
    private readonly SurveyManagementCommandContext _commandContext; // DbContext اصلی نوشتن (نامش را با پروژه خودتان تطبیق دهید)
    private readonly IUserManagementAclService _userManagementAclService;
    private readonly IPersonelInfoQueryService _personelInfoQueryService;
    private readonly ILogger<LegacyResponseDemographicMigrationService> _logger;

    public LegacyResponseDemographicMigrationService(
        LegacyResponseReadContext legacyContext,
        SurveyManagementQueryContext queryContext,
        SurveyManagementCommandContext commandContext,
        IUserManagementAclService userManagementAclService,
        IPersonelInfoQueryService personelInfoQueryService,
        ILogger<LegacyResponseDemographicMigrationService> logger)
    {
        _legacyContext = legacyContext;
        _queryContext = queryContext;
        _commandContext = commandContext;
        _userManagementAclService = userManagementAclService;
        _personelInfoQueryService = personelInfoQueryService;
        _logger = logger;
    }

    public async Task<MigrationResult> RunAsync()
    {
        var result = new MigrationResult();

        // ───── مرحلهٔ ۱: خواندن همهٔ ردیف‌های قدیمی ─────
        var legacyRows = await _legacyContext.LegacyResponses
            .AsNoTracking()
            .ToListAsync();

        result.TotalLegacyResponses = legacyRows.Count;
        _logger.LogInformation("شروع Migration دموگرافیک — {Count} پاسخ قدیمی یافت شد.", legacyRows.Count);

        // ───── مرحلهٔ ۲: حذف Draft/InProgress ─────
        var draftIds = legacyRows
            .Where(r => r.Status != LegacyStatusCompleted)
            .Select(r => r.Id)
            .ToList();

        if (draftIds.Count > 0)
        {
            // حذف Answersِ مرتبط اول (اگر FK بدون Cascade باشد)
            await _commandContext.Database.ExecuteSqlRawAsync(
                "DELETE FROM dbo.ResponseAnswers WHERE ResponseId IN (SELECT Id FROM dbo.Responses WHERE Status <> {0})",
                LegacyStatusCompleted);

            await _commandContext.Database.ExecuteSqlRawAsync(
                "DELETE FROM dbo.Responses WHERE Status <> {0}",
                LegacyStatusCompleted);

            result.DraftDeleted = draftIds.Count;
            _logger.LogInformation("{Count} پاسخ ناتمام (Draft/InProgress) حذف شد.", draftIds.Count);
        }

        var completedRows = legacyRows
            .Where(r => r.Status == LegacyStatusCompleted)
            .ToList();

        // ───── مرحلهٔ ۳: کش دموگرافیک به‌ازای هر کاربر یکتا ─────
        var userGuids = completedRows
            .Where(r => !r.IsAnonymous && r.RespondentUserGuid.HasValue)
            .Select(r => r.RespondentUserGuid!.Value)
            .Distinct()
            .ToList();

        _logger.LogInformation("{Count} کاربر یکتا برای resolve دموگرافیک یافت شد.", userGuids.Count);

        var demographicCache = new Dictionary<Guid, UserDemographicViewHelper?>();

        foreach (var batch in Chunk(userGuids, BatchSize))
        {
            foreach (var userGuid in batch)
            {
                try
                {
                    var basicUser = await _userManagementAclService.GetUserByAsync(userGuid);
                    var personnelCode = basicUser?.UserName;

                    if (string.IsNullOrEmpty(personnelCode))
                    {
                        result.UserLookupFailed++;
                        demographicCache[userGuid] = null;
                        continue;
                    }

                    var info = await _personelInfoQueryService.GetByPersonnelCodeAsync(personnelCode);
                    if (info == null)
                    {
                        result.PersonelInfoNotFound++;
                        demographicCache[userGuid] = null;
                        continue;
                    }

                    demographicCache[userGuid] = new UserDemographicViewHelper
                    {
                        Age = info.age,
                        Gender = info.Sgender,
                        Office = info.OfficeCode,
                        EmploymentType = info.EmployKindpers,
                        Education = info.MadrakTypeNameHs,
                        ShiftWorker = info.Nobatkar,
                        ExperienceYears = info.sabeghe,
                        OrganizationalGrade = info.PostBase,
                        OrganizationalGroup = info.GroupDesc
                    };
                }
                catch (Exception ex)
                {
                    result.Errors.Add($"خطا در resolve کاربر {userGuid}: {ex.Message}");
                    _logger.LogWarning(ex, "خطا در resolve دموگرافیک کاربر {UserGuid}", userGuid);
                    demographicCache[userGuid] = null;
                }
            }

            _logger.LogInformation("پیشرفت resolve کاربران: {Done}/{Total}",
                demographicCache.Count, userGuids.Count);
        }

        // ───── مرحلهٔ ۴: بروزرسانی Response ها + ساخت SurveyParticipant ─────
        var existingParticipants = await _queryContext.SurveyParticipants
            .Select(p => new { p.SurveyId, p.UserGuid })
            .ToListAsync();
        var existingParticipantSet = existingParticipants
            .Select(p => (p.SurveyId, p.UserGuid))
            .ToHashSet();

        foreach (var batch in Chunk(completedRows, BatchSize))
        {
            foreach (var legacyRow in batch)
            {
                try
                {
                    if (legacyRow.IsAnonymous || !legacyRow.RespondentUserGuid.HasValue)
                    {
                        // پاسخ ناشناس — هیچ دموگرافیکی برایش وجود ندارد؛ فقط دست‌نخورده باقی می‌ماند
                        result.AnonymousSkipped++;
                        continue;
                    }

                    var userGuid = legacyRow.RespondentUserGuid.Value;
                    demographicCache.TryGetValue(userGuid, out var demo);

                    // ✅ آپدیت مستقیم با SQL — چون نمونهٔ Entity جدید Response دیگر ستون‌های قدیمی را نمی‌شناسد
                    await _commandContext.Database.ExecuteSqlRawAsync(@"
                        UPDATE dbo.Responses
                        SET Age = {0}, Gender = {1}, Office = {2}, EmploymentType = {3},
                            Education = {4}, ShiftWorker = {5}, ExperienceYears = {6},
                            OrganizationalGrade = {7}, OrganizationalGroup = {8}
                        WHERE Id = {9}",
                        (object?)demo?.Age ?? DBNull.Value,
                        (object?)demo?.Gender ?? DBNull.Value,
                        (object?)demo?.Office ?? DBNull.Value,
                        (object?)demo?.EmploymentType ?? DBNull.Value,
                        (object?)demo?.Education ?? DBNull.Value,
                        (object?)demo?.ShiftWorker ?? DBNull.Value,
                        (object?)demo?.ExperienceYears ?? DBNull.Value,
                        (object?)demo?.OrganizationalGrade ?? DBNull.Value,
                        (object?)demo?.OrganizationalGroup ?? DBNull.Value,
                        legacyRow.Id);

                    result.CompletedMigrated++;

                    // ساخت SurveyParticipant (فقط اگه از قبل موجود نباشه)
                    var key = (legacyRow.SurveyId, userGuid);
                    if (!existingParticipantSet.Contains(key))
                    {
                        var participant = new SurveyParticipant(legacyRow.SurveyId, userGuid);
                        _commandContext.SurveyParticipants.Add(participant);
                        existingParticipantSet.Add(key);
                        result.ParticipantsCreated++;
                    }
                }
                catch (Exception ex)
                {
                    result.Errors.Add($"خطا در پردازش Response {legacyRow.Id}: {ex.Message}");
                    _logger.LogError(ex, "خطا در پردازش Response {ResponseId}", legacyRow.Id);
                }
            }

            await _commandContext.SaveChangesAsync();
            _logger.LogInformation("پیشرفت migration پاسخ‌ها: {Done}/{Total}",
                result.CompletedMigrated + result.AnonymousSkipped, completedRows.Count);
        }

        _logger.LogInformation(
            "Migration کامل شد. موفق: {Migrated}، ناشناس رد شده: {Anon}، Draft حذف شده: {Draft}، " +
            "شکست Lookup کاربر: {UserFail}، عدم تطابق vwPersonelInfo: {InfoFail}، Participant ساخته شده: {Participants}",
            result.CompletedMigrated, result.AnonymousSkipped, result.DraftDeleted,
            result.UserLookupFailed, result.PersonelInfoNotFound, result.ParticipantsCreated);

        return result;
    }

    private static IEnumerable<List<T>> Chunk<T>(List<T> source, int size)
    {
        for (int i = 0; i < source.Count; i += size)
            yield return source.Skip(i).Take(size).ToList();
    }
}
