using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Common.Extensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using QRCoder;
using SurveyManagement.Common;
using SurveyManagement.Common.Extensions;
using SurveyManagement.Domain.Shared.Access;
using SurveyManagement.Domain.Shared.Acls.UserManagement;
using SurveyManagement.Infrastructure.Persistence;
using SurveyManagement.Infrastructure.Persistence.Views;
using SurveyManagement.Infrastructure.Query.Contract.Response;
using SurveyManagement.Infrastructure.Query.Contract.Survey;

namespace SurveyManagement.Infrastructure.Query;

public class SurveyQueryHandler(
    SurveyManagementQueryContext context,
    IUserManagementAclService userManagementAclService,
    IConfiguration configuration,
    ISurveyAccessService access,
    IResponseDraftKeys draftKeys) :
    IQueryHandlerAsync<Result<List<SurveyListDto>>, SurveySearchRequest>,
    IQueryHandlerAsync<Result<SurveyDetailDto>, Guid>,
    IQueryHandlerAsync<Result<List<SurveyComboDto>>>,
    IQueryHandlerAsync<Result<SurveyStatisticsDto>, GetSurveyStatisticsRequest>,
    IQueryHandlerAsync<Result<List<SurveyChangeLogDto>>, GetSurveyChangeLogsRequest>,
    IQueryHandlerAsync<Result<GetSurveyWithQuestionsResponse>, GetSurveyWithQuestionsRequest>,
    IQueryHandlerAsync<Result<PublicSurveyDto>, GetPublicSurveyRequest>,
    IQueryHandlerAsync<Result<SurveyPublicLinkDto>, GetSurveyPublicLinkRequest>,
    IQueryHandlerAsync<Result<List<MySurveyListDto>>, GetMySurveysRequest>,
    IQueryHandlerAsync<Result<List<MySurveyListDto>>, Guid?>
{
    /// <summary>
    /// ✅ هم‌راستا با ResponseQueryHandler — حداقل تعداد نفرات لازم برای نمایش یک دستهٔ دموگرافیک
    /// </summary>
    private const int K_ANONYMITY_THRESHOLD = 5;
    private const int MaxPageSize = 200;

    private const string NoAccess = "شما به این نظرسنجی دسترسی ندارید.";

    /// <summary>
    /// جستجوی نظرسنجی‌ها با فیلتر
    /// </summary>
    public async Task<Result<List<SurveyListDto>>> Handle(SurveySearchRequest request)
    {
        // فقط نظرسنجی‌هایی که کاربر مالک، مدیر یا دارنده‌ی دسترسی مدیریت/نتایج آن‌هاست (مدیر سامانه: همه)
        var manageable = await access.ManageableSurveyIdsAsync();

        var query = context.Surveys.AsNoTracking()
            .WhereIf(manageable is not null, s => manageable!.Contains(s.Id))
            .WhereIf(!string.IsNullOrEmpty(request.Title), s => s.Title.Contains(request.Title))
            .WhereIf(request.Status.HasValue, s => s.Status == request.Status.Value)
            .WhereIf(request.AccessType.HasValue, s => s.AccessType == request.AccessType.Value)
            .WhereIf(request.CreatorUserGuid.HasValue, s => s.CreatedBy == request.CreatorUserGuid.Value)
            .WhereIf(request.AllowAnonymous.HasValue, s => s.AllowAnonymous == request.AllowAnonymous.Value)
            .Where(s => !s.IsRemoved);

        if (!string.IsNullOrEmpty(request.StartDateFrom))
        {
            var startDate = request.StartDateFrom.ToDateTime();
            query = query.Where(s => s.StartDate >= startDate);
        }

        if (!string.IsNullOrEmpty(request.StartDateTo))
        {
            var startDate = request.StartDateTo.ToDateTime();
            query = query.Where(s => s.StartDate <= startDate);
        }

        if (!string.IsNullOrEmpty(request.EndDateFrom))
        {
            var endDate = request.EndDateFrom.ToDateTime();
            query = query.Where(s => s.EndDate >= endDate);
        }

        if (!string.IsNullOrEmpty(request.EndDateTo))
        {
            var endDate = request.EndDateTo.ToDateTime();
            query = query.Where(s => s.EndDate <= endDate);
        }

        var pageSize = Math.Clamp(request.PageSize, 1, MaxPageSize);
        var pageNumber = Math.Max(1, request.PageNumber);

        var surveys = await query
            .OrderByDescending(s => s.Created)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(s => new
            {
                s.Guid,
                s.Title,
                s.Description,
                s.StartDate,
                s.EndDate,
                s.Status,
                s.AccessType,
                s.TotalResponses,
                s.MaxResponses,
                s.AllowAnonymous,
                s.IsActive,
                s.CreatedBy,
                s.Created
            })
            .ToListAsync();

        var userGuids = surveys.Select(s => (Guid?)s.CreatedBy).Distinct().ToList();
        var users = await userManagementAclService.GetUsersByGuidsAsync(userGuids);
        var userDict = users.ToDictionary(u => u.Guid, u => u.Fullname);

        var result = surveys.Select(s => new SurveyListDto
        {
            Guid = s.Guid,
            Title = s.Title,
            Description = s.Description.Length > 100 ? s.Description.Substring(0, 100) + "..." : s.Description,
            StartDate = s.StartDate.ToString("yyyy/MM/dd"),
            EndDate = s.EndDate.ToString("yyyy/MM/dd"),
            Status = s.Status.GetDisplayName(),
            StatusEnum = s.Status,
            AccessType = s.AccessType.GetDisplayName(),
            TotalResponses = s.TotalResponses,
            MaxResponses = s.MaxResponses,
            AllowAnonymous = s.AllowAnonymous,
            IsActive = s.IsActive == 1,
            CreatedBy = userDict.TryGetValue(s.CreatedBy, out var name) ? name : "نامشخص",
            Created = s.Created.ToString("yyyy/MM/dd HH:mm")
        }).ToList();

        return Result<List<SurveyListDto>>.Success(result);
    }

    /// <summary>
    /// دریافت جزئیات نظرسنجی با Guid
    /// </summary>
    public async Task<Result<SurveyDetailDto>> Handle(Guid guid)
    {
        var survey = await context.Surveys
            .Include(s => s.Questions)
            .Include(x=>x.Criteria)
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Guid == guid && !s.IsRemoved);

        if (survey == null)
            return Result<SurveyDetailDto>.Failure(null, "نظرسنجی یافت نشد.");
        if (!((await access.GetAsync(survey.Id))?.CanView ?? false))
            return Result<SurveyDetailDto>.Failure(null, NoAccess);

        var user = await userManagementAclService.GetUserByAsync(survey.CreatedBy);
        var publishedUser = survey.PublishedBy.HasValue
            ? await userManagementAclService.GetUserByAsync(survey.PublishedBy.Value)
            : null;

        var result = new SurveyDetailDto
        {
            Guid = survey.Guid,
            Title = survey.Title,
            Description = survey.Description,
            StartDate = survey.StartDate.ToString("yyyy/MM/dd"),
            EndDate = survey.EndDate.ToString("yyyy/MM/dd"),
            Status = survey.Status,
            StatusText = survey.Status.GetDisplayName(),
            AccessType = survey.AccessType,
            ShowType = survey.ShowType,
            AccessTypeText = survey.AccessType.GetDisplayName(),
            AllowAnonymous = survey.AllowAnonymous,
            AllowSaveDraft = survey.AllowSaveDraft, // ⚠️ پایین توضیح داده شده
            ShowProgressBar = survey.ShowProgressBar,
            RandomizeQuestions = survey.RandomizeQuestions,
            AllowMultipleResponses = survey.AllowMultipleResponses,
            WelcomeMessage = survey.WelcomeMessage,
            ThankYouMessage = survey.ThankYouMessage,
            MaxResponses = survey.MaxResponses,
            TotalResponses = survey.TotalResponses,
            RequireLogin = survey.RequireLogin,
            Version = survey.Version,
            PublishedDate = survey.PublishedDate?.ToString("yyyy/MM/dd HH:mm"),
            PublishedBy = publishedUser?.Fullname,
            ThemeColor = survey.ThemeColor,
            CompletionEffect = survey.CompletionEffect,
            LogoGuid = survey.LogoGuid,
            BackgroundImageGuid = survey.BackgroundImageGuid,
            TotalQuestions = survey.Questions.Count,
            CreatedBy = user?.Fullname ?? "نامشخص",
            Created = survey.Created.ToString("yyyy/MM/dd HH:mm"),
            HasCriteria = survey.Criteria.Any(c => !c.IsRemoved), // ✅ اگه IsRemoved روی SurveyCriterion ندارید، فقط survey.Criteria.Any()
            Criteria = survey.Criteria
            .OrderBy(c => c.SortOrder)
            .Select(c => new SurveyCriterionDto
            {
                Guid = c.Guid,
                Title = c.Title,
                Description = c.Description,
                SortOrder = c.SortOrder
            }).ToList()
        };

        return Result<SurveyDetailDto>.Success(result);
    }

    /// <summary>
    /// لیست نظرسنجی‌ها برای ComboBox
    /// </summary>
    public async Task<Result<List<SurveyComboDto>>> Handle()
    {
        var manageable = await access.ManageableSurveyIdsAsync();
        var surveys = await context.Surveys.AsNoTracking()
            .Where(s => !s.IsRemoved && s.IsActive == 1)
            .WhereIf(manageable is not null, s => manageable!.Contains(s.Id))
            .OrderByDescending(s => s.Created)
            .Select(s => new SurveyComboDto
            {
                Guid = s.Guid,
                Title = s.Title
            })
            .ToListAsync();

        return Result<List<SurveyComboDto>>.Success(surveys);
    }

    /// <summary>
    /// ✅ آمار نظرسنجی — چون دیگه Draft/Device نداریم، به‌جاش بریک‌داون دموگرافیک (k-anonymized) اضافه شد
    /// </summary>
    /// <summary>
    /// ✅ آمار نظرسنجی — بریک‌داون روی هر ۹ بُعد دموگرافیک، با k-anonymity
    /// </summary>
    public async Task<Result<SurveyStatisticsDto>> Handle(GetSurveyStatisticsRequest request)
    {
        var survey = await context.Surveys
            .Include(s => s.Questions)
            .Include(s => s.Responses.Where(r => r.Status == ResponseStatus.Completed))
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Guid == request.SurveyId && !s.IsRemoved);

        if (survey == null)
            return Result<SurveyStatisticsDto>.Failure(null, "نظرسنجی یافت نشد.");
        if (!((await access.GetAsync(survey.Id))?.CanViewResults ?? false))
            return Result<SurveyStatisticsDto>.Failure(null, NoAccess);

        // فقط پاسخ‌های تکمیل‌شده (پیش‌نویس‌ها در آمار نمی‌آیند)
        var responses = survey.Responses.ToList();
        var total = responses.Count;

        var avgTimeSpentMinutes = responses
            .Where(r => r.TimeSpentSeconds.HasValue)
            .Select(r => r.TimeSpentSeconds!.Value)
            .DefaultIfEmpty(0)
            .Average() / 60;

        var responsesByDate = responses
            .Where(r => r.CompletedAt.HasValue)
            .GroupBy(r => r.CompletedAt!.Value.Date)
            .OrderBy(g => g.Key)
            .ToDictionary(g => g.Key.ToString("yyyy/MM/dd"), g => g.Count());

        var statistics = new SurveyStatisticsDto
        {
            SurveyGuid = survey.Guid,
            Title = survey.Title,
            TotalQuestions = survey.Questions.Count(q => !q.IsRemoved),
            TotalResponses = survey.TotalResponses,
            AverageTimeSpent = (decimal)Math.Round(avgTimeSpentMinutes, 2),
            ResponsesByDate = responsesByDate,

            // ✅ نام پراپرتی‌ها دقیقاً منطبق با SurveyStatisticsDto و فیلدهای واقعی Response
            ResponsesByAge = BuildDemographicBreakdown(responses, r => r.Age?.ToString(), total),
            ResponsesByGender = BuildDemographicBreakdown(responses, r => r.Gender, total),
            ResponsesByOffice = BuildDemographicBreakdown(responses, r => r.Office, total),
            ResponsesByEmploymentType = BuildDemographicBreakdown(responses, r => r.EmploymentType, total),
            ResponsesByEducation = BuildDemographicBreakdown(responses, r => r.Education, total),
            ResponsesByShiftWorker = BuildDemographicBreakdown(responses, r => r.ShiftWorker, total),
            ResponsesByExperienceYears = BuildDemographicBreakdown(responses, r => r.ExperienceYears?.ToString(), total),
            ResponsesByOrganizationalGrade = BuildDemographicBreakdown(responses, r => r.OrganizationalGrade, total),
            ResponsesByOrganizationalGroup = BuildDemographicBreakdown(responses, r => r.OrganizationalGroup, total)
        };

        return Result<SurveyStatisticsDto>.Success(statistics);
    }
    private List<DemographicBucketDto> BuildDemographicBreakdown(
        List<Domain.ResponseAgg.Response> responses,
        Func<Domain.ResponseAgg.Response, string?> selector,
        int total)
    {
        var groups = responses
            .Where(r => !string.IsNullOrEmpty(selector(r)))
            .GroupBy(selector)
            .Select(g => new { Label = g.Key!, Count = g.Count() })
            .OrderByDescending(g => g.Count)
            .ToList();

        var visible = groups.Where(g => g.Count >= K_ANONYMITY_THRESHOLD).ToList();
        var suppressedCount = groups.Where(g => g.Count < K_ANONYMITY_THRESHOLD).Sum(g => g.Count);

        var result = visible
            .Select(g => new DemographicBucketDto(
                g.Label,
                g.Count,
                total > 0 ? Math.Round((decimal)g.Count / total * 100, 1) : 0))
            .ToList();

        if (suppressedCount > 0)
        {
            result.Add(new DemographicBucketDto(
                "سایر (به‌دلیل حفظ محرمانگی نمایش داده نمی‌شود)",
                suppressedCount,
                total > 0 ? Math.Round((decimal)suppressedCount / total * 100, 1) : 0));
        }

        return result;
    }

    /// <summary>
    /// تاریخچه تغییرات نظرسنجی
    /// </summary>
    public async Task<Result<List<SurveyChangeLogDto>>> Handle(GetSurveyChangeLogsRequest request)
    {
        var survey = await context.Surveys.AsNoTracking().FirstOrDefaultAsync(s => s.Guid == request.SurveyId);
        if (survey == null)
            return Result<List<SurveyChangeLogDto>>.Failure(null, "نظرسنجی یافت نشد.");
        if (!((await access.GetAsync(survey.Id))?.CanManage ?? false))
            return Result<List<SurveyChangeLogDto>>.Failure(null, NoAccess);

        var logs = await context.SurveyChangeLogs
            .Where(l => l.SurveyId == survey.Id)
            .OrderByDescending(l => l.ChangeDate)
            .Select(l => new
            {
                l.Id,
                l.ChangeType,
                l.Description,
                l.Version,
                l.ChangeDate,
                ChangedBy = l.CreatedBy
            })
            .ToListAsync();

        var userGuids = logs.Select(l => (Guid?)l.ChangedBy).Distinct().ToList();
        var users = await userManagementAclService.GetUsersByGuidsAsync(userGuids);
        var userDict = users.ToDictionary(u => u.Guid, u => u.Fullname);

        var result = logs.Select(l => new SurveyChangeLogDto
        {
            Id = l.Id,
            ChangeType = l.ChangeType.GetDisplayName(),
            Description = l.Description,
            Version = l.Version,
            ChangeDate = l.ChangeDate.ToString("yyyy/MM/dd HH:mm"),
            ChangedBy = userDict.TryGetValue(l.ChangedBy, out var name) ? name : "نامشخص"
        }).ToList();

        return Result<List<SurveyChangeLogDto>>.Success(result);
    }

    /// <summary>
    /// دریافت نظرسنجی همراه با سوالات برای Edit Mode — بدون تغییر
    /// </summary>
    public async Task<Result<GetSurveyWithQuestionsResponse>> Handle(GetSurveyWithQuestionsRequest request)
    {
        var survey = await context.Surveys
            .Include(x=>x.Criteria)
            .Include(s => s.Questions.OrderBy(q => q.SortOrder))
                .ThenInclude(q => q.Options.OrderBy(o => o.SortOrder))
            .Include(s => s.Questions)
                .ThenInclude(q => q.QuestionLogics.OrderBy(l => l.Priority))
            .Include(x=>x.Questions)
                .ThenInclude(x=>x.Criterion)
            .FirstOrDefaultAsync(s => s.Guid == request.SurveyGuid && !s.IsRemoved);

        if (survey == null)
            return Result<GetSurveyWithQuestionsResponse>.Failure(null, "نظرسنجی یافت نشد.");
        // شامل فهرست دسترسی‌ها و تنظیمات کامل؛ فقط برای کسی که حق ویرایش دارد
        if (!((await access.GetAsync(survey.Id))?.CanManage ?? false))
            return Result<GetSurveyWithQuestionsResponse>.Failure(null, NoAccess);

        var surveyDto = new SurveyForEditDto
        {
            Guid = survey.Guid,
            Title = survey.Title,
            Description = survey.Description,
            StartDate = survey.StartDate.ToString("yyyy/MM/dd"),
            EndDate = survey.EndDate.ToString("yyyy/MM/dd"),
            AccessType = survey.AccessType,
            ShowType = survey.ShowType,
            AllowAnonymous = survey.AllowAnonymous,
            AllowSaveDraft = survey.AllowSaveDraft,
            ShowProgressBar = survey.ShowProgressBar,
            RandomizeQuestions = survey.RandomizeQuestions,
            AllowMultipleResponses = survey.AllowMultipleResponses,
            RequireLogin = survey.RequireLogin,
            WelcomeMessage = survey.WelcomeMessage,
            ThankYouMessage = survey.ThankYouMessage,
            MaxResponses = survey.MaxResponses,
            ThemeColor = survey.ThemeColor,
            CompletionEffect = survey.CompletionEffect,
            LogoGuid = survey.LogoGuid,
            BackgroundImageGuid = survey.BackgroundImageGuid,
            HasCriteria=survey.Criteria.Any()
        };

        var questionsDto = survey.Questions.Select(q => new QuestionForEditDto
        {
            Guid = q.Guid,
            TempId = $"existing_{q.Guid}",
            QuestionText = q.QuestionText,
            QuestionType = q.QuestionType,
            SortOrder = q.SortOrder,
            IsRequired = q.IsRequired,
            CriterionGuid = q.Criterion?.Guid, // ✅ اضافه شد
            HelpText = q.HelpText,
            Placeholder = q.Placeholder,
            ImageGuid = q.ImageUrl,
            VideoGuid = q.VideoUrl,
            ValidationType = q.ValidationType,
            ValidationErrorMessage = q.ValidationErrorMessage,
            ValidationRegex = q.CustomValidationRegex,
            MinLength = q.MinLength,
            MaxLength = q.MaxLength,
            MinValue = q.MinValue,
            MaxValue = q.MaxValue,
            MinSelection = q.MinSelections,
            MaxSelection = q.MaxSelections,
            MaxFileSize = q.MaxFileSize,
            AllowedFileTypes = q.AllowedFileTypes,
            MinScaleLabel = q.MinScaleLabel,
            MaxScaleLabel = q.MaxScaleLabel,
            MatrixRowsJson = q.MatrixRows,
            MatrixColumnsJson = q.MatrixColumns,
            RandomizeOptions = q.RandomizeOptions,
            AllowOtherOption = q.AllowOtherOption,
            OtherOptionText = q.OtherOptionText,
            Options = q.Options.Select(o => new QuestionOptionForEditDto
            {
                Guid = o.Guid,
                TempId = $"existing_{o.Guid}",
                OptionText = o.OptionText,
                SortOrder = o.SortOrder,
                Value = o.Value,
                ImageGuid = o.ImageFile,
                Color = o.Color
            }).ToList(),
            LogicRules = q.QuestionLogics.Select(l => new QuestionLogicForEditDto
            {
                Guid = l.Guid,
                TargetQuestionGuid = l.TargetQuestion != null ? l.TargetQuestion.Guid : Guid.Empty,
                LogicType = l.LogicType,
                ConditionOperator = l.ConditionOperator,
                ConditionValue = l.ConditionValue,
                SelectedOptionGuid = l.Option != null ? l.Option.Guid : null,
                Priority = l.Priority
            }).ToList()
        }).ToList();
      
        var response = new GetSurveyWithQuestionsResponse
        {
            Survey = surveyDto,
            Questions = questionsDto,
        };
        var criteria = await context.SurveyCriteria   // اگر DbSet با این اسم در context ندارید، پایین توضیح داده شده
                    .Where(c => c.SurveyId == survey.Id)
                    .OrderBy(c => c.SortOrder)
                    .ToListAsync();

        var criteriaDto = criteria.Select(c => new SurveyCriterionEditDto
        {
            Guid = c.Guid,
            TempId = $"existing_{c.Guid}",
            Title = c.Title,
            Description = c.Description,
            SortOrder = c.SortOrder
        }).ToList();
        var accesses = await context.SurveyAccess
            .Where(a => a.SurveyId == survey.Id && a.IsActive == 1)
            .ToListAsync();

        var accessUserGuids = accesses.Select(a => (Guid?)a.TargetGuid).Where(g => g.HasValue).ToList();
        var accessUsers = await userManagementAclService.GetUsersByGuidsAsync(accessUserGuids);
        var accessUserDict = accessUsers.ToDictionary(u => u.Guid, u => u);

        var accessItemsDto = accesses.Select(a => new AccessItemForEditDto
        {
            Guid = a.Guid,
            TempId = $"existing_{a.Guid}",
            TargetType = a.TargetType,
            TargetGuid = a.TargetGuid ?? Guid.Empty,
            TargetName = a.TargetGuid.HasValue && accessUserDict.TryGetValue(a.TargetGuid.Value, out var user)
                ? user.Fullname : "نامشخص",
            CanView = a.CanView,
            CanRespond = a.CanRespond,
            CanViewResults = a.CanViewResults,
            CanEdit = a.CanEdit,
            CanDelete = a.CanDelete,
            ExpirationDate = a.ExpirationDate?.ToString("yyyy/MM/dd"),
        }).ToList();

        response.AccessItems = accessItemsDto;
        response.Criteria = criteriaDto;
        return Result<GetSurveyWithQuestionsResponse>.Success(response);
    }

    /// <summary>
    /// دریافت اطلاعات نظرسنجی برای پاسخ‌دهی عمومی — بدون تغییر
    /// </summary>
    public async Task<Result<PublicSurveyDto>> Handle(GetPublicSurveyRequest request)
    {
        var survey = await context.Surveys.AsNoTracking()
            .Include(s => s.Questions.Where(q => !q.IsRemoved).OrderBy(q => q.SortOrder))
                .ThenInclude(q => q.Options.OrderBy(o => o.SortOrder))
            .Include(s => s.Questions.Where(q => !q.IsRemoved))
                .ThenInclude(q => q.QuestionLogics)
            .Include(s => s.Criteria)
            .AsSplitQuery()
            .FirstOrDefaultAsync(s => s.Guid == request.SurveyGuid && !s.IsRemoved);

        if (survey == null)
            return Result<PublicSurveyDto>.Failure(null, "نظرسنجی یافت نشد.");

        var questionGuidById = survey.Questions.ToDictionary(q => q.Id, q => q.Guid);
        var optionGuidById = survey.Questions.SelectMany(q => q.Options).GroupBy(o => o.Id).ToDictionary(g => g.Key, g => g.First().Guid);
        var criterionGuidById = (survey.Criteria ?? []).ToDictionary(c => c.Id, c => c.Guid);

        // همان قواعد ثبت پاسخ (منتشرشده یا در حال اجرا؛ روز آخر هم قابل پاسخ است)
        if (survey.Status != SurveyStatus.Active && survey.Status != SurveyStatus.Published)
            return Result<PublicSurveyDto>.Failure(null, "این نظرسنجی فعال نیست.");

        var today = DateTime.Now.Date;
        if (today < survey.StartDate.Date || today > survey.EndDate.Date)
            return Result<PublicSurveyDto>.Failure(null, "این نظرسنجی خارج از بازه زمانی مجاز است.");

        var identity = await access.IdentityAsync();
        if (identity.IsAuthenticated
                ? !((await access.GetAsync(survey.Id))?.CanRespond ?? false)
                : survey.RequireLogin || survey.AccessType != AccessType.Public)
            return Result<PublicSurveyDto>.Failure(null, identity.IsAuthenticated ? NoAccess : "برای پاسخ به این نظرسنجی باید وارد سامانه شوید.");

        var isFull = survey.MaxResponses.HasValue && survey.TotalResponses >= survey.MaxResponses.Value;

        var result = new PublicSurveyDto
        {
            Guid = survey.Guid,
            Title = survey.Title,
            Description = survey.Description,
            WelcomeMessage = survey.WelcomeMessage,
            ThankYouMessage = survey.ThankYouMessage,
            ThemeColor = survey.ThemeColor,
            CompletionEffect = survey.CompletionEffect,
            LogoGuid = survey.LogoGuid,
            BackgroundImageGuid = survey.BackgroundImageGuid,
            AllowAnonymous = survey.AllowAnonymous,
            AllowSaveDraft = survey.AllowSaveDraft,
            ShowProgressBar = survey.ShowProgressBar,
            RandomizeQuestions = survey.RandomizeQuestions,
            AllowMultipleResponses = survey.AllowMultipleResponses,
            RequireLogin = survey.RequireLogin,
            TotalQuestions = survey.Questions.Count,
            MaxResponses = survey.MaxResponses,
            TotalResponses = survey.TotalResponses,
            StartDate = survey.StartDate.ToString("yyyy/MM/dd"),
            EndDate = survey.EndDate.ToString("yyyy/MM/dd"),
            IsActive = survey.Status is SurveyStatus.Active or SurveyStatus.Published,
            IsExpired = today > survey.EndDate.Date,
            IsFull = isFull,
            ShowType = (int)survey.ShowType,
            Criteria = (survey.Criteria ?? []).OrderBy(c => c.SortOrder)
                .Select(c => new PublicCriterionDto { Guid = c.Guid, Title = c.Title, Description = c.Description, SortOrder = c.SortOrder })
                .ToList(),
            Questions = survey.Questions.OrderBy(q => q.SortOrder).Select(q => new PublicQuestionDto
            {
                Guid = q.Guid,
                QuestionText = q.QuestionText,
                QuestionType = q.QuestionType,
                QuestionTypeName = q.QuestionType.GetDisplayName(),
                SortOrder = q.SortOrder,
                IsRequired = q.IsRequired,
                HelpText = q.HelpText,
                Placeholder = q.Placeholder,
                ImageUrl = q.ImageUrl,
                VideoUrl = q.VideoUrl,
                ValidationType = q.ValidationType,
                ValidationErrorMessage = q.ValidationErrorMessage,
                MinLength = q.MinLength,
                MaxLength = q.MaxLength,
                MinValue = q.MinValue,
                MaxValue = q.MaxValue,
                RandomizeOptions = q.RandomizeOptions,
                AllowOtherOption = q.AllowOtherOption,
                OtherOptionText = q.OtherOptionText,
                MinScaleLabel = q.MinScaleLabel,
                MaxScaleLabel = q.MaxScaleLabel,
                MatrixRowsJson = q.MatrixRows,
                MatrixColumnsJson = q.MatrixColumns,
                MaxFileSize = q.MaxFileSize,
                AllowedFileTypes = q.AllowedFileTypes,
                CriterionGuid = q.CriterionId is { } cid && criterionGuidById.TryGetValue(cid, out var cg) ? cg : null,
                MinSelections = q.MinSelections,
                MaxSelections = q.MaxSelections,
                CustomValidationRegex = q.CustomValidationRegex,
                MatrixRows = ParseTextList(q.MatrixRows),
                MatrixColumns = ParseTextList(q.MatrixColumns),
                Logics = (q.QuestionLogics ?? []).OrderBy(l => l.Priority).Select(l => new PublicLogicDto
                {
                    TargetQuestionGuid = l.TargetQuestionId is { } tid && questionGuidById.TryGetValue(tid, out var tg) ? tg : null,
                    LogicType = (int)l.LogicType,
                    ConditionOperator = (int)l.ConditionOperator,
                    ConditionValue = l.ConditionValue,
                    OptionGuid = l.OptionId is { } oid && optionGuidById.TryGetValue(oid, out var og) ? og : null,
                    Priority = l.Priority
                }).ToList(),
                Options = q.Options.Select(o => new PublicOptionDto
                {
                    Guid = o.Guid,
                    OptionText = o.OptionText,
                    SortOrder = o.SortOrder,
                    Value = o.Value,
                    ImageUrl = o.ImageFile,
                    Color = o.Color
                }).ToList()
            }).ToList()
        };

        if (survey.RandomizeQuestions)
        {
            var random = new Random();
            result.Questions = result.Questions.OrderBy(x => random.Next()).ToList();
        }

        return Result<PublicSurveyDto>.Success(result);
    }

    /// <summary>ردیف/ستون ماتریس: JSON array یا جداشده با کاما/خط جدید (هم‌سان با اعتبارسنج ثبت پاسخ)</summary>
    private static List<string> ParseTextList(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return new();
        raw = raw.Trim();
        if (raw.StartsWith('['))
        {
            try { return (System.Text.Json.JsonSerializer.Deserialize<List<string>>(raw) ?? new()).Select(x => x.Trim()).Where(x => x.Length > 0).ToList(); }
            catch (System.Text.Json.JsonException) { }
        }
        return raw.Split([',', '،', '\n', '\r', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
    }

    /// <summary>
    /// دریافت لینک عمومی و QR Code — بدون تغییر
    /// </summary>
    public async Task<Result<SurveyPublicLinkDto>> Handle(GetSurveyPublicLinkRequest request)
    {
        var survey = await context.Surveys.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Guid == request.SurveyGuid && !s.IsRemoved);

        if (survey == null)
            return Result<SurveyPublicLinkDto>.Failure(null, "نظرسنجی یافت نشد.");
        if (!((await access.GetAsync(survey.Id))?.CanManage ?? false))
            return Result<SurveyPublicLinkDto>.Failure(null, NoAccess);

        // فرانت مانند مدیریت جلسات با مسیر hash کار می‌کند (لینک‌های قدیمی بدون # هم در فرانت تبدیل می‌شوند)
        var publicUrl = $"{configuration["EndPoint"]?.TrimEnd('/')}/#/survey/take/{survey.Guid}";
        var qrCodeBase64 = GenerateQRCode(publicUrl);

        var result = new SurveyPublicLinkDto
        {
            SurveyGuid = survey.Guid,
            Title = survey.Title,
            PublicUrl = publicUrl,
            QRCodeBase64 = qrCodeBase64,
            IsActive = survey.Status is SurveyStatus.Active or SurveyStatus.Published,
            Status = survey.Status.GetDisplayName(),
            StartDate = survey.StartDate.ToString("yyyy/MM/dd"),
            EndDate = survey.EndDate.ToString("yyyy/MM/dd")
        };

        return Result<SurveyPublicLinkDto>.Success(result);
    }

    private string GenerateQRCode(string url)
    {
        try
        {
            using var qrGenerator = new QRCodeGenerator();
            using var qrCodeData = qrGenerator.CreateQrCode(url, QRCodeGenerator.ECCLevel.Q);
            using var qrCode = new PngByteQRCode(qrCodeData);

            var qrCodeBytes = qrCode.GetGraphic(20);
            return Convert.ToBase64String(qrCodeBytes);
        }
        catch
        {
            return string.Empty;
        }
    }

    /// <summary>
    /// نظرسنجی‌های قابل پاسخ برای کاربر جاری (کاربر فقط از توکن؛ UserGuid درخواست نادیده گرفته می‌شود).
    /// دسترسی: فهرست دسترسی (کاربر / سمت / واحد / نقش، با انقضا) + نظرسنجی‌های عمومی.
    /// وضعیت: تکمیل (SurveyParticipant) / در حال پاسخ (پیش‌نویس) / شروع نشده / منقضی.
    /// </summary>
    public async Task<Result<List<MySurveyListDto>>> Handle(GetMySurveysRequest request) =>
        await BuildMySurveys(request.UserGuid, request.Filter);

    public async Task<Result<List<MySurveyListDto>>> Handle(Guid? condition) =>
        await BuildMySurveys(condition, filter: null);

    /// <summary>
    /// منطق مشترک بین دو overload بالا — قبلاً کاملاً تکراری بود، اینجا یکپارچه شد
    /// </summary>
    private async Task<Result<List<MySurveyListDto>>> BuildMySurveys(Guid? requestedUserGuid, MySurveyFilter? filter)
    {
        var now = DateTime.Now;

        var identity = await access.IdentityAsync();
        if (!identity.IsAuthenticated)
            return Result<List<MySurveyListDto>>.Success(new List<MySurveyListDto>());
        Guid? userGuid = identity.UserGuid;

        // ===== مرحله ۱: نظرسنجی‌هایی که این کاربر بهشون دسترسی داره =====
        var accessibleSurveyIds = (await access.RespondableSurveyIdsAsync()).ToList();

        // ===== مرحله ۲: بارگذاری نظرسنجی‌ها (فعال + منتشرشده؛ دسترسی‌دار یا عمومی) =====
        var surveys = await context.Surveys
            .AsNoTracking()
            .Where(s => (accessibleSurveyIds.Contains(s.Id) || s.AccessType == AccessType.Public)
                      && !s.IsRemoved
                      && (s.Status == SurveyStatus.Published || s.Status == SurveyStatus.Active))
            .Include(s => s.Questions)
            .OrderByDescending(s => s.Created)
            .ToListAsync();

        if (!surveys.Any())
            return Result<List<MySurveyListDto>>.Success(new List<MySurveyListDto>());

        var surveyIds = surveys.Select(s => s.Id).ToList();

        // ===== مرحله ۳: ✅ شرکت‌کردن کاربر — فقط از SurveyParticipant، نه از Response =====
        // هیچ اطلاعاتی از محتوای پاسخ یا پیشرفت نمی‌خونیم، فقط اینکه شرکت کرده یا نه.
        var participatedSurveyIds = userGuid.HasValue
            ? (await context.SurveyParticipants
                .Where(p => surveyIds.Contains(p.SurveyId) && p.UserGuid == userGuid.Value)
                .Select(p => p.SurveyId)
                .ToListAsync())
                .ToHashSet()
            : new HashSet<long>();

        // ===== مرحله ۳-ب: پیش‌نویس‌ها (کلید HMAC؛ بدون ستون کاربر) =====
        var draftKeyBySurvey = surveys.ToDictionary(s => draftKeys.For(s.Id, userGuid.Value), s => s.Id);
        var draftKeyList = draftKeyBySurvey.Keys.ToList();
        var drafts = await context.Responses.AsNoTracking()
            .Where(r => draftKeyList.Contains(r.Guid) && r.Status == ResponseStatus.InProgress)
            .Select(r => new
            {
                r.Guid,
                r.SurveyId,
                Answered = r.Answers.Count(a => !a.IsSkipped),
                Last = r.Answers.Max(a => (DateTime?)a.AnsweredAt) ?? r.StartedAt
            })
            .ToListAsync();
        var draftBySurvey = drafts
            .Where(d => draftKeyBySurvey.TryGetValue(d.Guid, out var sid) && sid == d.SurveyId)
            .ToDictionary(d => d.SurveyId);

        // ===== مرحله ۴: نام ایجادکنندگان =====
        var creatorGuids = surveys.Select(s => (Guid?)s.CreatedBy).Distinct().ToList();
        var users = await userManagementAclService.GetUsersByGuidsAsync(creatorGuids);
        var userDict = users.ToDictionary(u => u.Guid, u => u.Fullname);

        // ===== مرحله ۵: ساخت DTOs =====
        var result = new List<MySurveyListDto>();

        foreach (var survey in surveys)
        {
            var isExpired = now.Date > survey.EndDate.Date;
            var isFull = survey.MaxResponses.HasValue
                      && survey.TotalResponses >= survey.MaxResponses.Value;
            var daysRemaining = isExpired ? 0 : (survey.EndDate.Date - now.Date).Days;

            var hasParticipated = participatedSurveyIds.Contains(survey.Id);
            draftBySurvey.TryGetValue(survey.Id, out var draft);
            var totalQuestions = survey.Questions.Count(q => !q.IsRemoved);

            MyResponseStatus responseStatus = hasParticipated && !(survey.AllowMultipleResponses && draft is not null)
                ? MyResponseStatus.Completed
                : isExpired ? MyResponseStatus.Expired
                : draft is not null ? MyResponseStatus.InProgress
                : MyResponseStatus.NotStarted;

            if (filter.HasValue && filter != MySurveyFilter.All)
            {
                var matchesFilter = filter switch
                {
                    MySurveyFilter.NotStarted => responseStatus == MyResponseStatus.NotStarted,
                    MySurveyFilter.InProgress => responseStatus == MyResponseStatus.InProgress,
                    MySurveyFilter.Completed => responseStatus == MyResponseStatus.Completed,
                    MySurveyFilter.Expired => responseStatus == MyResponseStatus.Expired,
                    _ => true
                };
                if (!matchesFilter) continue;
            }

            var responseStatusText = responseStatus switch
            {
                MyResponseStatus.NotStarted => "شروع نشده",
                MyResponseStatus.InProgress => "در حال پاسخ‌دهی",
                MyResponseStatus.Completed => "تکمیل شده",
                MyResponseStatus.Expired => "منقضی شده",
                _ => "نامشخص"
            };

            var progress = responseStatus == MyResponseStatus.Completed ? 100
                : draft is not null && totalQuestions > 0 ? (int)Math.Round(draft.Answered * 100.0 / totalQuestions)
                : 0;

            result.Add(new MySurveyListDto
            {
                Guid = survey.Guid,
                Title = survey.Title,
                Description = survey.Description.Length > 150
                    ? survey.Description.Substring(0, 150) + "..."
                    : survey.Description,
                StartDate = survey.StartDate.ToString("yyyy/MM/dd"),
                EndDate = survey.EndDate.ToString("yyyy/MM/dd"),
                TotalQuestions = totalQuestions,
                SurveyStatus = survey.Status.GetDisplayName(),
                IsActive = survey.Status == SurveyStatus.Active || survey.Status == SurveyStatus.Published,
                IsExpired = isExpired,
                ThemeColor = survey.ThemeColor,
                CompletionEffect = survey.CompletionEffect,
                LogoGuid = survey.LogoGuid,
                AllowAnonymous = survey.AllowAnonymous,
                AllowSaveDraft = true, // پاسخ‌های کاربر واردشده همیشه خودکار ذخیره می‌شود
                MaxResponses = survey.MaxResponses,
                TotalResponses = survey.TotalResponses,
                IsFull = isFull,
                ResponseStatus = responseStatus,
                ResponseStatusText = responseStatusText,
                ProgressPercentage = progress,
                ExistingResponseGuid = null, // پیش‌نویس از روی کاربر (توکن) پیدا می‌شود؛ شناسه‌ای به کلاینت داده نمی‌شود
                LastActivityDate = draft?.Last.ToString("yyyy/MM/dd HH:mm"),
                CreatedBy = userDict.TryGetValue(survey.CreatedBy, out var name) ? name : "نامشخص",
                DaysRemaining = daysRemaining
            });
        }

        result = result
            .OrderBy(x => x.ResponseStatus switch
            {
                MyResponseStatus.InProgress => 0,
                MyResponseStatus.NotStarted => 1,
                MyResponseStatus.Completed => 2,
                MyResponseStatus.Expired => 3,
                _ => 4
            })
            .ThenByDescending(x => x.DaysRemaining == 0 ? int.MaxValue : x.DaysRemaining)
            .ToList();

        return Result<List<MySurveyListDto>>.Success(result);
    }
}
