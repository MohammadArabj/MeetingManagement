using Epc.Application.Command;
using Epc.Company.Query;
using Microsoft.EntityFrameworkCore;
using SurveyManagement.Application.Contract.Response;
using SurveyManagement.Application.Responses;
using SurveyManagement.Common;
using SurveyManagement.Domain.ParticipantAgg;
using SurveyManagement.Domain.QuestionAgg;
using SurveyManagement.Domain.ResponseAgg;
using SurveyManagement.Domain.Shared.Access;
using SurveyManagement.Domain.Shared.Acls.UserManagement;
using SurveyManagement.Domain.SurveyAgg;
using SurveyManagement.Infrastructure.Persistence;
using SurveyManagement.Infrastructure.Persistence.Views;

namespace SurveyManagement.Application;

/// <summary>
/// ثبت پاسخ، ذخیره‌ی پیش‌نویس (ادامه‌ی پاسخ‌دهی بعداً) و حذف پاسخ.
/// ─────────────────────────────────────────────────────────────────────────
///  • کاربر فقط از توکن خوانده می‌شود؛ دسترسی پاسخ‌دهی (عمومی / فهرست دسترسی / مالک) سمت سرور بررسی می‌شود.
///  • «ناشناس» فقط یعنی اطلاعات جمعیت‌شناختی ذخیره نشود؛ شرکت کاربر همیشه ثبت می‌شود
///    (قبلاً با isAnonymous=true محدودیت «یک بار پاسخ» دور زده می‌شد).
///  • هر پاسخ با تعریف خود سوال اعتبارسنجی می‌شود (<see cref="AnswerValidator"/>).
///  • پیش‌نویس: Response با وضعیت InProgress و Guid مشتق از HMAC (بدون ستون کاربر).
///  • شمارنده‌ی پاسخ‌ها و ظرفیت با یک UPDATE اتمیک کنترل می‌شود و کل ثبت در یک تراکنش است.
/// </summary>
public class ResponseCommandHandler(
    SurveyManagementCommandContext context,
    IUserManagementAclService userManagementAclService,
    IPersonelInfoQueryService personelInfoQueryService,
    ISurveyAccessService access,
    IResponseDraftKeys draftKeys) :
    ICommandHandlerAsync<SubmitResponseDto, Result<Guid>>,
    ICommandHandlerAsync<SaveResponseDraftDto, Result<ResponseDraftSavedDto>>,
    ICommandHandlerAsync<DiscardResponseDraftDto, Result<bool>>,
    ICommandHandlerAsync<DeleteResponseDto, Result<bool>>,
    ICommandHandlerAsync<AddResponseNoteDto, Result<bool>>
{
    // ═════════════════════════════ ثبت نهایی ═════════════════════════════

    public async Task<Result<Guid>> Handle(SubmitResponseDto command)
    {
        var (survey, error) = await LoadRespondableSurveyAsync(command.SurveyGuid);
        if (survey is null) return Result<Guid>.Failure(Guid.Empty, error!);

        var identity = await access.IdentityAsync();
        var userId = identity.IsAuthenticated ? identity.UserGuid : Guid.Empty;

        if (command.IsAnonymous && !survey.AllowAnonymous)
            return Result<Guid>.Failure(Guid.Empty, "این نظرسنجی پاسخ ناشناس نمی‌پذیرد.");

        if (userId != Guid.Empty && !survey.AllowMultipleResponses &&
            await context.SurveyParticipants.AnyAsync(p => p.SurveyId == survey.Id && p.UserGuid == userId))
            return Result<Guid>.Failure(Guid.Empty, "شما قبلاً به این نظرسنجی پاسخ داده‌اید.");

        var validator = new AnswerValidator(await LoadQuestionsAsync(survey.Id));

        // پیش‌نویس کاربر (اگر هست) پایه است و پاسخ‌های ارسالی روی آن نوشته می‌شوند
        var response = userId != Guid.Empty ? await LoadDraftAsync(survey.Id, userId) : null;
        response ??= new Response(survey.Id, null, null, null, null, null, null, null, null, null);

        var errors = ApplyAnswers(response, validator, command.Answers, strict: true);
        if (errors.Count > 0)
            return Result<Guid>.Failure(Guid.Empty, errors[0]);

        var missing = validator.Questions
            .Where(q => q.IsRequired && !validator.IsComplete(q, response.Answers.FirstOrDefault(a => a.QuestionId == q.Id)))
            .OrderBy(q => q.SortOrder)
            .ToList();
        if (missing.Count > 0)
            return Result<Guid>.Failure(Guid.Empty,
                $"لطفاً به سوال‌های اجباری پاسخ دهید ({missing.Count} سوال)؛ از جمله: «{missing[0].QuestionText}»");

        var demographics = !command.IsAnonymous && userId != Guid.Empty
            ? await LoadDemographicsAsync(userId)
            : default;

        await using var transaction = await context.Database.BeginTransactionAsync();
        try
        {
            // ظرفیت + شمارنده به‌صورت اتمیک (قبلاً خواندن و افزایش جدا بود و ظرفیت رد می‌شد)
            var reserved = await context.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE dbo.Surveys SET TotalResponses = TotalResponses + 1 WHERE Id = {survey.Id} AND (MaxResponses IS NULL OR TotalResponses < MaxResponses)");
            if (reserved == 0)
                return Result<Guid>.Failure(Guid.Empty, "ظرفیت نظرسنجی تکمیل شده است.");

            response.CompleteWith(demographics.Age, demographics.Gender, demographics.Office, demographics.EmploymentType,
                demographics.Education, demographics.ShiftWorker, demographics.ExperienceYears,
                demographics.OrganizationalGrade, demographics.OrganizationalGroup);

            if (response.Id == 0)
                context.Responses.Add(response);

            if (userId != Guid.Empty &&
                !await context.SurveyParticipants.AnyAsync(p => p.SurveyId == survey.Id && p.UserGuid == userId))
                context.SurveyParticipants.Add(new SurveyParticipant(survey.Id, userId));

            await context.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch (DbUpdateException)
        {
            // دو ثبت هم‌زمان (دوبار کلیک / دو تب): کلید (SurveyId, UserGuid) تکراری
            await transaction.RollbackAsync();
            context.ChangeTracker.Clear();
            return Result<Guid>.Failure(Guid.Empty, "پاسخ شما قبلاً ثبت شده است.");
        }

        return Result<Guid>.Success(response.Guid, "پاسخ شما با موفقیت ثبت شد. از شرکت شما متشکریم!");
    }

    // ═════════════════════════════ پیش‌نویس ═════════════════════════════

    public async Task<Result<ResponseDraftSavedDto>> Handle(SaveResponseDraftDto command)
    {
        var identity = await access.IdentityAsync();
        if (!identity.IsAuthenticated)
            return Result<ResponseDraftSavedDto>.Failure(null, "برای ذخیره‌ی پاسخ‌ها باید وارد سامانه شوید.");

        var (survey, error) = await LoadRespondableSurveyAsync(command.SurveyGuid);
        if (survey is null) return Result<ResponseDraftSavedDto>.Failure(null, error!);

        if (!survey.AllowMultipleResponses &&
            await context.SurveyParticipants.AnyAsync(p => p.SurveyId == survey.Id && p.UserGuid == identity.UserGuid))
            return Result<ResponseDraftSavedDto>.Failure(null, "شما قبلاً به این نظرسنجی پاسخ داده‌اید.");

        var validator = new AnswerValidator(await LoadQuestionsAsync(survey.Id));
        var draft = await LoadDraftAsync(survey.Id, identity.UserGuid);
        if (draft is null)
        {
            draft = Response.StartDraft(survey.Id, draftKeys.For(survey.Id, identity.UserGuid));
            context.Responses.Add(draft);
        }

        // مقدار نامعتبر (مثلاً ایمیل نیمه‌تمام) ذخیره نمی‌شود ولی بقیه‌ی پاسخ‌ها ذخیره می‌شوند
        var rejected = new List<Guid>();
        ApplyAnswers(draft, validator, command.Answers, strict: false, rejected);

        try
        {
            await context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // دو ذخیره‌ی هم‌زمان اولین پیش‌نویس (Guid یکتا)؛ دفعه‌ی بعد روی همان پیش‌نویس نوشته می‌شود
            context.ChangeTracker.Clear();
            return Result<ResponseDraftSavedDto>.Failure(null, "ذخیره‌ی خودکار با تداخل مواجه شد؛ دوباره تلاش می‌شود.");
        }

        var total = validator.Questions.Count;
        var answered = draft.Answers.Count(a => !a.IsSkipped);
        return Result<ResponseDraftSavedDto>.Success(new ResponseDraftSavedDto
        {
            AnsweredCount = answered,
            TotalQuestions = total,
            ProgressPercentage = total == 0 ? 0 : (int)Math.Round(answered * 100.0 / total),
            SavedAt = DateTime.Now.ToString("HH:mm"),
            RejectedQuestionGuids = rejected
        });
    }

    public async Task<Result<bool>> Handle(DiscardResponseDraftDto command)
    {
        var identity = await access.IdentityAsync();
        if (!identity.IsAuthenticated) return Result<bool>.Failure(false, "ابتدا وارد سامانه شوید.");

        var surveyId = await context.Surveys.Where(s => s.Guid == command.SurveyGuid).Select(s => s.Id).FirstOrDefaultAsync();
        if (surveyId == 0) return Result<bool>.Failure(false, "نظرسنجی یافت نشد.");

        var draft = await LoadDraftAsync(surveyId, identity.UserGuid);
        if (draft is null) return Result<bool>.Success(true);

        context.Responses.Remove(draft);
        await context.SaveChangesAsync();
        return Result<bool>.Success(true, "پاسخ‌های ذخیره‌شده پاک شد.");
    }

    // ═════════════════════════════ مدیریت پاسخ‌ها ═════════════════════════════

    public async Task<Result<bool>> Handle(DeleteResponseDto command)
    {
        var response = await context.Responses.FirstOrDefaultAsync(r => r.Guid == command.Guid);
        if (response == null)
            return Result<bool>.Failure(false, "پاسخ یافت نشد.");

        // حذف پاسخ ثبت‌شده فقط برای کسی که مدیریت نظرسنجی را دارد
        var info = await access.GetAsync(response.SurveyId);
        if (info is null || !info.CanManage)
            return Result<bool>.Failure(false, "شما مجاز به حذف پاسخ‌های این نظرسنجی نیستید.");

        var wasCompleted = response.Status == ResponseStatus.Completed;
        context.Responses.Remove(response);
        await context.SaveChangesAsync();

        if (wasCompleted)
            await context.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE dbo.Surveys SET TotalResponses = CASE WHEN TotalResponses > 0 THEN TotalResponses - 1 ELSE 0 END WHERE Id = {response.SurveyId}");

        return Result<bool>.Success(true, "پاسخ حذف شد.");
    }

    public async Task<Result<bool>> Handle(AddResponseNoteDto command)
    {
        // مدل داده‌ای برای یادداشت وجود ندارد؛ قبلاً فقط SaveChanges صدا زده می‌شد و موفقیت برمی‌گشت
        await Task.CompletedTask;
        return Result<bool>.Failure(false, "ثبت یادداشت برای پاسخ‌ها پشتیبانی نمی‌شود.");
    }

    // ═════════════════════════════ Helpers ═════════════════════════════

    /// <summary>نظرسنجی فعال، در بازه‌ی زمانی، با ظرفیت خالی و قابل پاسخ برای کاربر جاری</summary>
    private async Task<(Survey? Survey, string? Error)> LoadRespondableSurveyAsync(Guid surveyGuid)
    {
        var survey = await context.Surveys.FirstOrDefaultAsync(s => s.Guid == surveyGuid && !s.IsRemoved);
        if (survey is null) return (null, "نظرسنجی یافت نشد.");

        if (survey.Status != SurveyStatus.Published && survey.Status != SurveyStatus.Active)
            return (null, "نظرسنجی مورد نظر فعال نمی‌باشد.");

        var today = DateTime.Now.Date;
        if (today < survey.StartDate.Date) return (null, "نظرسنجی هنوز شروع نشده است.");
        if (today > survey.EndDate.Date) return (null, "مهلت پاسخ‌دهی به نظرسنجی تمام شده است.");

        if (survey.MaxResponses.HasValue && survey.TotalResponses >= survey.MaxResponses.Value)
            return (null, "ظرفیت نظرسنجی تکمیل شده است.");

        var identity = await access.IdentityAsync();
        if (!identity.IsAuthenticated)
        {
            // بدون ورود: فقط نظرسنجی عمومی که ورود را الزامی نکرده
            if (survey.RequireLogin || survey.AccessType != AccessType.Public)
                return (null, "برای پاسخ به این نظرسنجی باید وارد سامانه شوید.");
        }
        else
        {
            var info = await access.GetAsync(survey.Id);
            if (info is null || !info.CanRespond)
                return (null, "شما به این نظرسنجی دسترسی ندارید.");
        }

        return (survey, null);
    }

    private Task<List<Question>> LoadQuestionsAsync(long surveyId) =>
        context.Questions.AsNoTracking()
            .Where(q => q.SurveyId == surveyId && !q.IsRemoved)
            .Include(q => q.Options)
            .AsSplitQuery()
            .ToListAsync();

    private async Task<Response?> LoadDraftAsync(long surveyId, Guid userGuid)
    {
        var key = draftKeys.For(surveyId, userGuid);
        return await context.Responses
            .Include(r => r.Answers)
            .FirstOrDefaultAsync(r => r.Guid == key && r.SurveyId == surveyId && r.Status == ResponseStatus.InProgress);
    }

    /// <summary>
    /// اعمال پاسخ‌های ارسالی روی Response (یک پاسخ برای هر سوال؛ پاسخ خالی یعنی پاک کردن).
    /// strict: اولین خطا برگردانده می‌شود؛ در غیر این صورت سوال نامعتبر در rejected ثبت و رد می‌شود.
    /// </summary>
    private static List<string> ApplyAnswers(Response response, AnswerValidator validator,
        IEnumerable<ResponseAnswerDto>? answers, bool strict, List<Guid>? rejected = null)
    {
        var errors = new List<string>();
        var latest = (answers ?? []).GroupBy(a => a.QuestionGuid).Select(g => g.Last());

        foreach (var dto in latest)
        {
            if (!validator.TryGetQuestion(dto.QuestionGuid, out var question))
            {
                // سوال متعلق به این نظرسنجی نیست (یا حذف شده)
                if (strict) errors.Add("پاسخ ارسالی شامل سوالی است که در این نظرسنجی وجود ندارد.");
                rejected?.Add(dto.QuestionGuid);
                continue;
            }

            var answer = validator.Build(question, dto, out var error);
            if (error is not null)
            {
                if (strict) errors.Add($"«{question.QuestionText}»: {error}");
                rejected?.Add(dto.QuestionGuid);
                continue;
            }

            if (answer is null) response.RemoveAnswer(question.Id);
            else response.UpsertAnswer(answer);
        }

        return errors;
    }

    private readonly record struct Demographics(
        int? Age, string? Gender, string? Office, string? EmploymentType, string? Education,
        string? ShiftWorker, int? ExperienceYears, string? OrganizationalGrade, string? OrganizationalGroup);

    private async Task<Demographics> LoadDemographicsAsync(Guid userGuid)
    {
        try
        {
            var basicUser = await userManagementAclService.GetUserByAsync(userGuid);
            var personnelCode = basicUser?.UserName;
            if (string.IsNullOrEmpty(personnelCode)) return default;

            var info = await personelInfoQueryService.GetByPersonnelCodeAsync(personnelCode);
            return info is null
                ? default
                : new Demographics(info.age, info.Sgender, info.OfficeCode, info.EmployKindpers, info.MadrakTypeNameHs,
                    info.Nobatkar, info.sabeghe, info.PostBase, info.GroupDesc);
        }
        catch
        {
            // نبودِ اطلاعات جمعیت‌شناختی نباید ثبت پاسخ را ناکام بگذارد (UserManagement در دسترس نیست)
            return default;
        }
    }
}
