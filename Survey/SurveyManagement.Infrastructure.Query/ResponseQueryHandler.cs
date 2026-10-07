using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Common.Extensions;
using Microsoft.EntityFrameworkCore;
using SurveyManagement.Common;
using SurveyManagement.Common.Extensions;
using SurveyManagement.Domain.Shared.Access;
using SurveyManagement.Domain.Shared.Acls.UserManagement;
using SurveyManagement.Infrastructure.Persistence;
using SurveyManagement.Infrastructure.Query.Contract.Response;
using System.Text.Json;
using static Microsoft.AspNetCore.Hosting.Internal.HostingApplication;

namespace SurveyManagement.Infrastructure.Query;

public class ResponseQueryHandler(
    IUserManagementAclService userManagementAclService,
    SurveyManagementQueryContext context,
    ISurveyAccessService access) :
    IQueryHandlerAsync<Result<List<ResponseListDto>>, ResponseSearchRequest>,
    IQueryHandlerAsync<Result<ResponseDetailDto>, Guid>,
    IQueryHandlerAsync<Result<ResponseSummaryDto>, GetResponseSummaryRequest>,
    IQueryHandlerAsync<Result<ResponseMatrixDto>, GetResponseMatrixRequest>,
    IQueryHandlerAsync<Result<SurveyAnalyticsDto>, GetSurveyAnalyticsRequest>,
    IQueryHandlerAsync<Result<ParticipantsReportDto>, GetSurveyParticipantsRequest>
{
    private const int K_ANONYMITY_THRESHOLD = 5;
    private const int MaxPageSize = 200;

    // متن گزینه‌ها یک بار برای همه‌ی سوالات خوانده می‌شود (قبلاً یک کوئری برای هر پاسخ: N+1)
    private readonly Dictionary<long, string> _optionText = new();

    private async Task PreloadOptionsAsync(IEnumerable<long> questionIds)
    {
        var ids = questionIds.Distinct().ToList();
        if (ids.Count == 0) return;
        foreach (var o in await context.QuestionOptions.AsNoTracking()
                     .Where(o => ids.Contains(o.QuestionId))
                     .Select(o => new { o.Id, o.OptionText })
                     .ToListAsync())
            _optionText[o.Id] = o.OptionText;
    }

    private async Task<string?> OptionTextAsync(long id)
    {
        if (_optionText.TryGetValue(id, out var text)) return text;
        text = await context.QuestionOptions.AsNoTracking().Where(o => o.Id == id).Select(o => o.OptionText).FirstOrDefaultAsync();
        if (text is not null) _optionText[id] = text;
        return text;
    }

    private async Task<List<string>> OptionTextsAsync(IEnumerable<long> ids)
    {
        var list = new List<string>();
        foreach (var id in ids)
            if (await OptionTextAsync(id) is { } t) list.Add(t);
        return list;
    }

    /// <summary>نتایج فقط برای مالک، مدیر سامانه یا دارنده‌ی «مشاهده‌ی نتایج» همین نظرسنجی</summary>
    private async Task<bool> CanViewResultsAsync(long surveyId) =>
        (await access.GetAsync(surveyId))?.CanViewResults ?? false;

 

    public async Task<Result<List<ResponseListDto>>> Handle(ResponseSearchRequest request)
    {
        var survey = await context.Surveys.AsNoTracking().FirstOrDefaultAsync(s => s.Guid == request.SurveyGuid);
        if (survey == null)
            return Result<List<ResponseListDto>>.Failure(null, "نظرسنجی یافت نشد.");
        if (!await CanViewResultsAsync(survey.Id))
            return Result<List<ResponseListDto>>.Failure(null, "شما به نتایج این نظرسنجی دسترسی ندارید.");

        var pageSize = Math.Clamp(request.PageSize, 1, MaxPageSize);
        var pageNumber = Math.Max(1, request.PageNumber);

        var query = context.Responses.AsNoTracking()
            .Where(r => r.SurveyId == survey.Id && r.Status == ResponseStatus.Completed)
            .WhereIf(!string.IsNullOrEmpty(request.Gender), r => r.Gender == request.Gender)
            .WhereIf(!string.IsNullOrEmpty(request.Office), r => r.Office == request.Office)
            .WhereIf(!string.IsNullOrEmpty(request.EmploymentType), r => r.EmploymentType == request.EmploymentType)
            .WhereIf(!string.IsNullOrEmpty(request.Education), r => r.Education == request.Education)
            .WhereIf(!string.IsNullOrEmpty(request.ShiftWorker), r => r.ShiftWorker == request.ShiftWorker)
            .WhereIf(!string.IsNullOrEmpty(request.OrganizationalGrade), r => r.OrganizationalGrade == request.OrganizationalGrade)
            .WhereIf(!string.IsNullOrEmpty(request.OrganizationalGroup), r => r.OrganizationalGroup == request.OrganizationalGroup);

        if (!string.IsNullOrEmpty(request.CompletedDateFrom))
        {
            var date = request.CompletedDateFrom.ToDateTime();
            query = query.Where(r => r.CompletedAt.HasValue && r.CompletedAt.Value >= date);
        }

        if (!string.IsNullOrEmpty(request.CompletedDateTo))
        {
            var date = request.CompletedDateTo.ToDateTime();
            query = query.Where(r => r.CompletedAt.HasValue && r.CompletedAt.Value <= date);
        }

        var responses = await query
            .Include(r => r.Survey)
            .OrderByDescending(r => r.StartedAt)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new
            {
                r.Guid,
                SurveyTitle = r.Survey.Title,
                r.Age,
                r.Gender,
                r.Office,
                r.EmploymentType,
                r.Education,
                r.ShiftWorker,
                r.ExperienceYears,
                r.OrganizationalGrade,
                r.OrganizationalGroup,
                r.StartedAt,
                r.CompletedAt,
                r.TimeSpentSeconds
            })
            .ToListAsync();

        var result = responses.Select(r => new ResponseListDto
        {
            Guid = r.Guid,
            SurveyGuid = survey.Guid,
            SurveyTitle = r.SurveyTitle,
            Age = r.Age,
            Gender = r.Gender,
            Office = r.Office,
            EmploymentType = r.EmploymentType,
            Education = r.Education,
            ShiftWorker = r.ShiftWorker,
            ExperienceYears = r.ExperienceYears,
            OrganizationalGrade = r.OrganizationalGrade,
            OrganizationalGroup = r.OrganizationalGroup,
            StartedAt = r.StartedAt.ToString("yyyy/MM/dd HH:mm"),
            CompletedAt = r.CompletedAt?.ToString("yyyy/MM/dd HH:mm"),
            TimeSpentSeconds = r.TimeSpentSeconds,
            TimeSpentText = FormatTimeSpent(r.TimeSpentSeconds)
        }).ToList();

        return Result<List<ResponseListDto>>.Success(result);
    }

    public async Task<Result<ResponseDetailDto>> Handle(Guid responseGuid)
    {
        var response = await context.Responses
            .Include(r => r.Survey)
            .Include(r => r.Answers)
                .ThenInclude(a => a.Question)
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Guid == responseGuid && r.Status == ResponseStatus.Completed);

        if (response == null)
            return Result<ResponseDetailDto>.Failure(null, "پاسخ یافت نشد.");
        if (!await CanViewResultsAsync(response.SurveyId))
            return Result<ResponseDetailDto>.Failure(null, "شما به نتایج این نظرسنجی دسترسی ندارید.");

        var detail = new ResponseDetailDto
        {
            Guid = response.Guid,
            SurveyGuid = response.Survey.Guid,
            SurveyTitle = response.Survey.Title,
            Age = response.Age,
            Gender = response.Gender,
            Office = response.Office,
            EmploymentType = response.EmploymentType,
            Education = response.Education,
            ShiftWorker = response.ShiftWorker,
            ExperienceYears = response.ExperienceYears,
            OrganizationalGrade = response.OrganizationalGrade,
            OrganizationalGroup = response.OrganizationalGroup,
            StartedAt = response.StartedAt.ToString("yyyy/MM/dd HH:mm"),
            CompletedAt = response.CompletedAt?.ToString("yyyy/MM/dd HH:mm"),
            TimeSpentSeconds = response.TimeSpentSeconds,
            Answers = await MapAnswersWithOptionsAsync(response.Answers.ToList())
        };

        return Result<ResponseDetailDto>.Success(detail);
    }

    public async Task<Result<ResponseSummaryDto>> Handle(GetResponseSummaryRequest request)
    {
        var survey = await context.Surveys
            .AsNoTracking()
            .Include(s => s.Responses.Where(r => r.Status == ResponseStatus.Completed))
            .FirstOrDefaultAsync(s => s.Guid == request.SurveyId);

        if (survey == null)
            return Result<ResponseSummaryDto>.Failure(null, "نظرسنجی یافت نشد.");
        if (!await CanViewResultsAsync(survey.Id))
            return Result<ResponseSummaryDto>.Failure(null, "شما به نتایج این نظرسنجی دسترسی ندارید.");

        var avgTimeSpent = survey.Responses
            .Where(r => r.TimeSpentSeconds.HasValue)
            .Select(r => r.TimeSpentSeconds!.Value)
            .DefaultIfEmpty(0)
            .Average() / 60;

        var responsesByDate = survey.Responses
            .Where(r => r.CompletedAt.HasValue)
            .GroupBy(r => r.CompletedAt!.Value.Date)
            .OrderBy(g => g.Key)
            .ToDictionary(g => g.Key.ToString("yyyy/MM/dd"), g => g.Count());

        var summary = new ResponseSummaryDto
        {
            SurveyGuid = survey.Guid,
            SurveyTitle = survey.Title,
            TotalResponses = survey.Responses.Count,
            AverageTimeSpent = (decimal)Math.Round(avgTimeSpent, 2),
            ResponsesByDate = responsesByDate
        };

        return Result<ResponseSummaryDto>.Success(summary);
    }

    // GetUserResponseStatusRequest → ResponseDraftQueryHandler (کاربر از توکن، نه از آدرس)

    public async Task<Result<ResponseMatrixDto>> Handle(GetResponseMatrixRequest request)
    {
        var survey = await context.Surveys.AsNoTracking().FirstOrDefaultAsync(s => s.Guid == request.SurveyGuid);
        if (survey == null)
            return Result<ResponseMatrixDto>.Failure(null, "نظرسنجی یافت نشد.");
        if (!await CanViewResultsAsync(survey.Id))
            return Result<ResponseMatrixDto>.Failure(null, "شما به نتایج این نظرسنجی دسترسی ندارید.");

        var questions = await context.Questions
            .AsNoTracking()
            .Include(q => q.Criterion)
            .Where(q => q.SurveyId == survey.Id && !q.IsRemoved)
            .OrderBy(q => q.Criterion != null ? q.Criterion.SortOrder : int.MaxValue)
            .ThenBy(q => q.SortOrder)
            .ToListAsync();
        await PreloadOptionsAsync(questions.Select(q => q.Id));

        var responses = await context.Responses
            .AsNoTracking()
            .Include(r => r.Answers)
                .ThenInclude(a => a.Question)
            .Where(r => r.SurveyId == survey.Id && r.Status == ResponseStatus.Completed)
            .OrderBy(r => r.CompletedAt ?? r.StartedAt)
            .ToListAsync();

        var matrix = new ResponseMatrixDto
        {
            SurveyGuid = survey.Guid,
            SurveyTitle = survey.Title,
            Questions = questions.Select(q => new MatrixQuestionColumnDto
            {
                QuestionGuid = q.Guid,
                QuestionText = q.QuestionText,
                QuestionType = (int)q.QuestionType,
                OrderIndex = q.SortOrder,
                IsRequired = q.IsRequired,
                CriterionTitle = q.Criterion?.Title,
                CriterionSortOrder = q.Criterion?.SortOrder
            }).ToList()
        };

        foreach (var response in responses)
        {
            var row = new MatrixResponseRowDto
            {
                ResponseGuid = response.Guid,
                Age = response.Age,
                Gender = response.Gender,
                Office = response.Office,
                EmploymentType = response.EmploymentType,
                Education = response.Education,
                ShiftWorker = response.ShiftWorker,
                ExperienceYears = response.ExperienceYears,
                OrganizationalGrade = response.OrganizationalGrade,
                OrganizationalGroup = response.OrganizationalGroup,
                StartedAt = response.StartedAt.ToString("yyyy/MM/dd HH:mm"),
                CompletedAt = response.CompletedAt?.ToString("yyyy/MM/dd HH:mm"),
                TimeSpentText = FormatTimeSpent(response.TimeSpentSeconds)
            };

            foreach (var answer in response.Answers)
            {
                row.Answers[answer.Question.Guid.ToString()] = await FormatAnswerForMatrix(answer);
            }

            matrix.Rows.Add(row);
        }

        return Result<ResponseMatrixDto>.Success(matrix);
    }

    #region Private Methods

    private async Task<List<ResponseAnswerDetailDto>> MapAnswersWithOptionsAsync(List<Domain.ResponseAgg.ResponseAnswer> answers)
    {
        await PreloadOptionsAsync(answers.Select(a => a.QuestionId));
        return await MapAnswersToDto(answers);
    }

    private async Task<List<ResponseAnswerDetailDto>> MapAnswersToDto(
        List<Domain.ResponseAgg.ResponseAnswer> answers)
    {
        var result = new List<ResponseAnswerDetailDto>();

        foreach (var answer in answers)
        {
            var dto = new ResponseAnswerDetailDto
            {
                Id = answer.Id,
                QuestionGuid = answer.Question.Guid,
                QuestionText = answer.Question.QuestionText,
                QuestionType = answer.QuestionType,
                TextAnswer = answer.TextAnswer,
                NumericAnswer = answer.NumericAnswer,
                DateAnswer = answer.DateAnswer?.ToString("yyyy/MM/dd"),
                OtherAnswer = answer.OtherAnswer,
                FileUrl = answer.FileUrl,
                FileName = answer.FileName,
                MatrixAnswers = ParseJsonDictionary(answer.MatrixAnswers),
                RankingAnswers = ParseJsonList<string>(answer.RankingAnswers),
                AnsweredAt = answer.AnsweredAt.ToString("yyyy/MM/dd HH:mm"),
                TimeSpentSeconds = answer.TimeSpentSeconds,
                IsSkipped = answer.IsSkipped
            };

            if (answer.SelectedOptionId.HasValue)
                dto.SelectedOption = await OptionTextAsync(answer.SelectedOptionId.Value);

            if (!string.IsNullOrEmpty(answer.SelectedOptionIds))
            {
                var optionIds = ParseJsonList<long>(answer.SelectedOptionIds);
                if (optionIds?.Any() == true)
                    dto.SelectedOptions = await OptionTextsAsync(optionIds);
            }

            result.Add(dto);
        }

        return result;
    }

    private async Task<string> FormatAnswerForMatrix(Domain.ResponseAgg.ResponseAnswer answer)
    {
        if (answer.IsSkipped)
            return "رد شده";

        switch (answer.QuestionType)
        {
            case QuestionType.ShortText:
            case QuestionType.LongText:
            case QuestionType.Email:
            case QuestionType.Phone:
            case QuestionType.Address:
                return string.IsNullOrWhiteSpace(answer.TextAnswer) ? "-" : answer.TextAnswer;

            case QuestionType.Number:
            case QuestionType.Rating:
            case QuestionType.LinearScale:
            case QuestionType.NPS:
                return answer.NumericAnswer?.ToString() ?? "-";

            case QuestionType.Date:
            case QuestionType.Time:
                return answer.DateAnswer?.ToString("yyyy/MM/dd") ?? "-";

            case QuestionType.SingleChoice:
            case QuestionType.Dropdown:
            case QuestionType.YesNo:
                {
                    if (!answer.SelectedOptionId.HasValue)
                        return string.IsNullOrWhiteSpace(answer.OtherAnswer) ? "-" : $"سایر: {answer.OtherAnswer}";
                    var text = await OptionTextAsync(answer.SelectedOptionId.Value) ?? "-";
                    return string.IsNullOrWhiteSpace(answer.OtherAnswer) ? text : $"{text} (سایر: {answer.OtherAnswer})";
                }

            case QuestionType.MultipleChoice:
                {
                    var parts = new List<string>();
                    if (!string.IsNullOrEmpty(answer.SelectedOptionIds))
                    {
                        var optionIds = ParseJsonList<long>(answer.SelectedOptionIds);
                        if (optionIds?.Any() == true)
                            parts.AddRange(await OptionTextsAsync(optionIds));
                    }
                    if (!string.IsNullOrWhiteSpace(answer.OtherAnswer))
                        parts.Add($"سایر: {answer.OtherAnswer}");

                    return parts.Any() ? string.Join(" | ", parts) : "-";
                }

            case QuestionType.FileUpload:
                return answer.FileName ?? "-";

            case QuestionType.Ranking:
                {
                    var ranking = ParseJsonList<string>(answer.RankingAnswers);
                    if (ranking == null || ranking.Count == 0) return "-";
                    return string.Join(" ← ", ranking);
                }

            default:
                return "-";
        }
    }

    private string? FormatTimeSpent(int? seconds)
    {
        if (!seconds.HasValue || seconds.Value == 0) return null;
        var timeSpan = TimeSpan.FromSeconds(seconds.Value);
        if (timeSpan.TotalMinutes < 1) return $"{seconds} ثانیه";
        if (timeSpan.TotalHours < 1) return $"{(int)timeSpan.TotalMinutes} دقیقه";
        return $"{(int)timeSpan.TotalHours} ساعت و {timeSpan.Minutes} دقیقه";
    }

    private List<T>? ParseJsonList<T>(string? json)
    {
        if (string.IsNullOrEmpty(json)) return null;
        try { return JsonSerializer.Deserialize<List<T>>(json); }
        catch { return null; }
    }

    private Dictionary<string, string>? ParseJsonDictionary(string? json)
    {
        if (string.IsNullOrEmpty(json)) return null;
        try { return JsonSerializer.Deserialize<Dictionary<string, string>>(json); }
        catch { return null; }
    }

    #endregion

    public async Task<Result<SurveyAnalyticsDto>> Handle(GetSurveyAnalyticsRequest request)
    {
        var survey = await context.Surveys.AsNoTracking().FirstOrDefaultAsync(s => s.Guid == request.SurveyGuid);
        if (survey == null)
            return Result<SurveyAnalyticsDto>.Failure(null, "نظرسنجی یافت نشد.");
        if (!await CanViewResultsAsync(survey.Id))
            return Result<SurveyAnalyticsDto>.Failure(null, "شما به نتایج این نظرسنجی دسترسی ندارید.");

        var questions = await context.Questions
            .AsNoTracking()
            .Include(q => q.Criterion)
            .Where(q => q.SurveyId == survey.Id && !q.IsRemoved)
            .OrderBy(q => q.Criterion != null ? q.Criterion.SortOrder : int.MaxValue)
            .ThenBy(q => q.SortOrder)
            .ToListAsync();

        var questionIds = questions.Select(q => q.Id).ToList();

        var options = await context.QuestionOptions
            .Where(o => questionIds.Contains(o.QuestionId))
            .ToListAsync();
        var optionsByQuestion = options
            .GroupBy(o => o.QuestionId)
            .ToDictionary(g => g.Key, g => g.OrderBy(o => o.SortOrder).ToList());

        var allResponses = await context.Responses
            .AsNoTracking()
            .Where(r => r.SurveyId == survey.Id && r.Status == ResponseStatus.Completed)
            .ToListAsync();

        var responseIds = allResponses.Select(r => r.Id).ToList();

        var answers = await context.ResponseAnswers
            .Where(a => responseIds.Contains(a.ResponseId))
            .ToListAsync();

        var answersByQuestion = answers.GroupBy(a => a.QuestionId).ToDictionary(g => g.Key, g => g.ToList());

        var dto = new SurveyAnalyticsDto
        {
            SurveyGuid = survey.Guid,
            SurveyTitle = survey.Title,
            Overview = BuildOverview(allResponses)
        };

        var totalRespondents = allResponses.Count;

        foreach (var question in questions)
        {
            answersByQuestion.TryGetValue(question.Id, out var qAnswers);
            qAnswers ??= new List<Domain.ResponseAgg.ResponseAnswer>();

            optionsByQuestion.TryGetValue(question.Id, out var qOptions);
            qOptions ??= new List<Domain.QuestionAgg.QuestionOption>();

            var qDto = new QuestionAnalyticsDto
            {
                QuestionGuid = question.Guid,
                QuestionText = question.QuestionText,
                QuestionType = (int)question.QuestionType,
                QuestionTypeName = question.QuestionType.GetDisplayName(),
                SortOrder = question.SortOrder,
                IsRequired = question.IsRequired,
                CriterionGuid = question.Criterion?.Guid,
                CriterionTitle = question.Criterion?.Title,
                CriterionSortOrder = question.Criterion?.SortOrder,
                TotalAnswered = qAnswers.Count(a => !a.IsSkipped),
                TotalSkipped = qAnswers.Count(a => a.IsSkipped)
            };

            qDto.AnswerRate = totalRespondents > 0
                ? Math.Round((decimal)qDto.TotalAnswered / totalRespondents * 100, 1)
                : 0;

            switch (question.QuestionType)
            {
                case QuestionType.SingleChoice:
                case QuestionType.Dropdown:
                case QuestionType.YesNo:
                    qDto.OptionStats = BuildSingleChoiceStats(qAnswers, qOptions);
                    break;
                case QuestionType.MultipleChoice:
                    qDto.OptionStats = BuildMultipleChoiceStats(qAnswers, qOptions);
                    break;
                case QuestionType.Number:
                case QuestionType.Rating:
                case QuestionType.LinearScale:
                case QuestionType.NPS:
                    qDto.NumericStats = BuildNumericStats(qAnswers);
                    break;
                case QuestionType.ShortText:
                case QuestionType.LongText:
                case QuestionType.Email:
                case QuestionType.Phone:
                case QuestionType.Address:
                    qDto.TextAnalytics = BuildTextAnalytics(qAnswers);
                    break;
                case QuestionType.Date:
                case QuestionType.Time:
                    qDto.DateDistribution = BuildDateDistribution(qAnswers);
                    break;
                case QuestionType.FileUpload:
                    qDto.FileUploadCount = qAnswers.Count(a => !string.IsNullOrEmpty(a.FileUrl));
                    break;
                case QuestionType.Ranking:
                    qDto.RankingStats = BuildRankingStats(qAnswers, qOptions);
                    break;
            }

            dto.Questions.Add(qDto);
        }

        dto.Criteria = BuildCriteriaSummary(dto.Questions);
        return Result<SurveyAnalyticsDto>.Success(dto);
    }

    /// <summary>
    /// خلاصه‌ی هر گام: نرخ پاسخ، میانگین نرمال‌شده‌ی سوال‌های امتیازی و احساس پاسخ‌های متنی.
    /// اگر هیچ سوالی گام نداشته باشد خالی است؛ سوال‌های بدون گام در «سایر سوالات» می‌آیند.
    /// </summary>
    private static List<CriterionAnalyticsDto> BuildCriteriaSummary(List<QuestionAnalyticsDto> questions)
    {
        if (questions.All(q => q.CriterionGuid is null)) return new();

        return questions
            .GroupBy(q => new { q.CriterionGuid, Title = q.CriterionTitle ?? "سایر سوالات", Sort = q.CriterionSortOrder ?? int.MaxValue })
            .OrderBy(g => g.Key.Sort)
            .Select(g =>
            {
                var scores = g.Where(q => q.NumericStats is not null && q.TotalAnswered > 0)
                    .Select(q => NormalizedScore(q))
                    .Where(v => v.HasValue)
                    .Select(v => v!.Value)
                    .ToList();
                var texts = g.Where(q => q.TextAnalytics is { MeaningfulCount: > 0 }).ToList();
                return new CriterionAnalyticsDto
                {
                    Guid = g.Key.CriterionGuid,
                    Title = g.Key.Title,
                    SortOrder = g.Key.Sort == int.MaxValue ? 9999 : g.Key.Sort,
                    QuestionCount = g.Count(),
                    AverageAnswerRate = Math.Round(g.Average(q => q.AnswerRate), 1),
                    AverageScorePercent = scores.Count > 0 ? Math.Round(scores.Average(), 1) : null,
                    NetSentiment = texts.Count > 0 ? Math.Round(texts.Average(q => q.TextAnalytics!.Sentiment.NetSentiment), 1) : null,
                    QuestionGuids = g.Select(q => q.QuestionGuid).ToList()
                };
            })
            .ToList();
    }

    /// <summary>میانگین سوال امتیازی روی مقیاس ۰ تا ۱۰۰ (برای مقایسه‌ی گام‌ها با مقیاس‌های مختلف)</summary>
    private static decimal? NormalizedScore(QuestionAnalyticsDto q)
    {
        var stats = q.NumericStats!;
        decimal min, max;
        switch ((QuestionType)q.QuestionType)
        {
            case QuestionType.Rating: min = 1; max = Math.Max(5, stats.Max); break;
            case QuestionType.NPS: min = 0; max = 10; break;
            case QuestionType.LinearScale: min = Math.Min(0, stats.Min); max = Math.Max(10, stats.Max); break;
            default: return null; // عدد آزاد مقیاس مشخصی ندارد
        }
        return max <= min ? null : Math.Clamp((stats.Average - min) / (max - min) * 100, 0, 100);
    }

    #region Analytics Helpers

    private OverviewStatsDto BuildOverview(List<Domain.ResponseAgg.Response> all)
    {
        var overview = new OverviewStatsDto { TotalResponses = all.Count };

        var times = all
            .Where(r => r.TimeSpentSeconds is > 0)
            .Select(r => r.TimeSpentSeconds!.Value)
            .OrderBy(t => t)
            .ToList();

        overview.AverageTimeSpentMinutes = times.Any()
            ? Math.Round((decimal)times.Average() / 60, 1) : 0;

        if (times.Any())
        {
            overview.FastestCompletionTimeText = FormatTimeSpent(times.First());
            overview.SlowestCompletionTimeText = FormatTimeSpent(times.Last());
            overview.MedianCompletionTimeText = FormatTimeSpent(GetMedian(times));
        }

        var total = all.Count;
        int suppressed;

        // ✅ سن و سابقه حالا گروه‌بندی‌شده محاسبه می‌شوند، نه خام
        overview.ResponsesByAge = BuildDemographicBreakdown(
            all, r => GetAgeGroupLabel(r.Age), total, out suppressed);
        var maxSuppressed = suppressed;

        overview.ResponsesByGender = BuildDemographicBreakdown(all, r => r.Gender, total, out suppressed);
        maxSuppressed = Math.Max(maxSuppressed, suppressed);

        overview.ResponsesByOffice = BuildDemographicBreakdown(all, r => r.Office, total, out suppressed);
        maxSuppressed = Math.Max(maxSuppressed, suppressed);

        overview.ResponsesByEmploymentType = BuildDemographicBreakdown(all, r => r.EmploymentType, total, out suppressed);
        maxSuppressed = Math.Max(maxSuppressed, suppressed);

        overview.ResponsesByEducation = BuildDemographicBreakdown(all, r => r.Education, total, out suppressed);
        maxSuppressed = Math.Max(maxSuppressed, suppressed);

        overview.ResponsesByShiftWorker = BuildDemographicBreakdown(all, r => r.ShiftWorker, total, out suppressed);
        maxSuppressed = Math.Max(maxSuppressed, suppressed);

        // ✅ سابقه هم گروه‌بندی‌شده
        overview.ResponsesByExperienceYears = BuildDemographicBreakdown(
            all, r => GetExperienceGroupLabel(r.ExperienceYears), total, out suppressed);
        maxSuppressed = Math.Max(maxSuppressed, suppressed);

        overview.ResponsesByOrganizationalGrade = BuildDemographicBreakdown(all, r => r.OrganizationalGrade, total, out suppressed);
        maxSuppressed = Math.Max(maxSuppressed, suppressed);

        overview.ResponsesByOrganizationalGroup = BuildDemographicBreakdown(all, r => r.OrganizationalGroup, total, out suppressed);
        maxSuppressed = Math.Max(maxSuppressed, suppressed);

        overview.SuppressedForPrivacy = maxSuppressed;

        overview.ResponsesTrend = all
            .GroupBy(r => r.StartedAt.Date)
            .OrderBy(g => g.Key)
            .Select(g => new TrendPointDto(g.Key.ToString("yyyy/MM/dd"), g.Count()))
            .ToList();

        var dayNames = new[] { "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه", "شنبه" };
        overview.ResponsesByDayOfWeek = all
            .GroupBy(r => (int)r.StartedAt.DayOfWeek)
            .OrderBy(g => g.Key)
            .Select(g => new TrendPointDto(dayNames[g.Key], g.Count()))
            .ToList();

        overview.ResponsesByHourOfDay = all
            .GroupBy(r => r.StartedAt.Hour)
            .OrderBy(g => g.Key)
            .Select(g => new TrendPointDto($"{g.Key}:00", g.Count()))
            .ToList();

        return overview;
    }
    #region Age & Experience Bucketing (فقط برای گزارش‌گیری — دادهٔ خام دست‌نخورده می‌ماند)

    /// <summary>
    /// ✅ تبدیل سن خام به گروه سنی — فقط برای نمایش در Analytics/Excel/HTML.
    /// خود فیلد Response.Age همچنان مقدار خام را نگه می‌دارد.
    /// </summary>
    private static string? GetAgeGroupLabel(int? age)
    {
        if (!age.HasValue) return null;

        return age.Value switch
        {
            <= 25 => "زیر ۲۵ سال",
            >= 26 and <= 30 => "۲۶ تا ۳۰ سال",
            >= 31 and <= 35 => "۳۱ تا ۳۵ سال",
            >= 36 and <= 40 => "۳۶ تا ۴۰ سال",
            >= 41 and <= 45 => "۴۱ تا ۴۵ سال",
            _ => "بالاتر از ۴۶ سال"
        };
    }

    /// <summary>
    /// ✅ تبدیل سابقهٔ خام به گروه سابقه — فقط برای نمایش در Analytics/Excel/HTML.
    /// خود فیلد Response.ExperienceYears همچنان مقدار خام را نگه می‌دارد.
    /// </summary>
    private static string? GetExperienceGroupLabel(int? years)
    {
        if (!years.HasValue) return null;

        return years.Value switch
        {
            < 5 => "کمتر از ۵ سال",
            >= 5 and <= 10 => "۵ تا ۱۰ سال",
            >= 11 and <= 15 => "۱۱ تا ۱۵ سال",
            >= 16 and <= 20 => "۱۶ تا ۲۰ سال",
            _ => "بالاتر از ۲۰ سال"
        };
    }

    #endregion
    /// <summary>
    /// ✅ بریک‌داون تک‌بعدی با k-anonymity. توجه: این فقط تک‌بعدی سرکوب می‌کنه؛
    /// سرکوب ترکیبی (چند فیلتر همزمان) باید در لایه‌ی جستجو/فیلتر جداگانه اعمال بشه.
    /// </summary>
    /// <summary>
    /// ✅ نسخهٔ گسترش‌یافتهٔ BuildDemographicBreakdown با امکان ترتیب دلخواه (مثلاً ترتیب طبیعی سنی/سابقه)
    /// به‌جای مرتب‌سازی پیش‌فرض بر اساس بیشترین تعداد.
    /// </summary>
    private List<DemographicBucketDto> BuildDemographicBreakdown(
        List<Domain.ResponseAgg.Response> all,
        Func<Domain.ResponseAgg.Response, string?> selector,
        int total,
        out int suppressedCount,
        IReadOnlyList<string>? customOrder = null)
    {
        var groups = all
            .Where(r => !string.IsNullOrEmpty(selector(r)))
            .GroupBy(selector)
            .Select(g => (Label: g.Key!, Count: g.Count()))
            .ToList();

        IEnumerable<(string Label, int Count)> ordered;

        if (customOrder != null)
        {
            // ✅ دیکشنری برچسب→ایندکس برای مرتب‌سازی منطقی (مثلاً ترتیب صعودی گروه سنی/سابقه)
            var orderIndex = new Dictionary<string, int>();
            for (int i = 0; i < customOrder.Count; i++)
                orderIndex[customOrder[i]] = i;

            ordered = groups.OrderBy(g => orderIndex.TryGetValue(g.Label, out var idx) ? idx : int.MaxValue);
        }
        else
        {
            ordered = groups.OrderByDescending(g => g.Count);
        }

        var orderedList = ordered.ToList();

        var visible = orderedList.Where(g => g.Count >= K_ANONYMITY_THRESHOLD).ToList();
        var suppressed = orderedList.Where(g => g.Count < K_ANONYMITY_THRESHOLD).ToList();
        suppressedCount = suppressed.Sum(g => g.Count);

        var result = visible
            .Select(g => new DemographicBucketDto(
                g.Label, g.Count, total > 0 ? Math.Round((decimal)g.Count / total * 100, 1) : 0))
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

    /// <summary>ترتیب ثابت برچسب‌های گروه سنی برای نمایش منطقی در گزارش (نه بر اساس پرتکرارترین)</summary>
    private static readonly string[] AgeGroupOrder =
    {
    "زیر ۲۵ سال", "۲۶ تا ۳۰ سال", "۳۱ تا ۳۵ سال",
    "۳۶ تا ۴۰ سال", "۴۱ تا ۴۵ سال", "بالاتر از ۴۶ سال"
};

    /// <summary>ترتیب ثابت برچسب‌های گروه سابقه برای نمایش منطقی در گزارش</summary>
    private static readonly string[] ExperienceGroupOrder =
    {
    "کمتر از ۵ سال", "۵ تا ۱۰ سال", "۱۱ تا ۱۵ سال",
    "۱۶ تا ۲۰ سال", "بالاتر از ۲۰ سال"
};

    private static int GetMedian(List<int> sorted)
    {
        if (!sorted.Any()) return 0;
        var mid = sorted.Count / 2;
        return sorted.Count % 2 == 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    }

    private List<OptionStatDto> BuildSingleChoiceStats(
        List<Domain.ResponseAgg.ResponseAnswer> answers,
        List<Domain.QuestionAgg.QuestionOption> options)
    {
        var total = answers.Count(a => a.SelectedOptionId.HasValue || !string.IsNullOrEmpty(a.OtherAnswer));
        var stats = new List<OptionStatDto>();

        foreach (var option in options)
        {
            var count = answers.Count(a => a.SelectedOptionId == option.Id);
            stats.Add(new OptionStatDto
            {
                OptionText = option.OptionText,
                Count = count,
                Percentage = total > 0 ? Math.Round((decimal)count / total * 100, 1) : 0,
                Color = option.Color
            });
        }

        var otherCount = answers.Count(a => !string.IsNullOrEmpty(a.OtherAnswer));
        if (otherCount > 0)
        {
            stats.Add(new OptionStatDto
            {
                OptionText = "سایر",
                Count = otherCount,
                Percentage = total > 0 ? Math.Round((decimal)otherCount / total * 100, 1) : 0,
                Color = "#94a3b8"
            });
        }

        return stats.OrderByDescending(s => s.Count).ToList();
    }

    private List<OptionStatDto> BuildMultipleChoiceStats(
        List<Domain.ResponseAgg.ResponseAnswer> answers,
        List<Domain.QuestionAgg.QuestionOption> options)
    {
        var totalRespondents = answers.Count(a => !string.IsNullOrEmpty(a.SelectedOptionIds));
        var allSelectedIds = new List<long>();

        foreach (var answer in answers)
        {
            if (string.IsNullOrEmpty(answer.SelectedOptionIds)) continue;
            var ids = ParseJsonList<long>(answer.SelectedOptionIds);
            if (ids != null) allSelectedIds.AddRange(ids);
        }

        var stats = options.Select(option => new OptionStatDto
        {
            OptionText = option.OptionText,
            Count = allSelectedIds.Count(id => id == option.Id),
            Percentage = totalRespondents > 0
                ? Math.Round((decimal)allSelectedIds.Count(id => id == option.Id) / totalRespondents * 100, 1)
                : 0,
            Color = option.Color
        }).ToList();

        return stats.OrderByDescending(s => s.Count).ToList();
    }

    private NumericStatDto BuildNumericStats(List<Domain.ResponseAgg.ResponseAnswer> answers)
    {
        var values = answers
            .Where(a => a.NumericAnswer.HasValue)
            .Select(a => a.NumericAnswer!.Value)
            .OrderBy(v => v)
            .ToList();

        if (!values.Any()) return new NumericStatDto();

        var stat = new NumericStatDto
        {
            Average = Math.Round(values.Average(), 2),
            Min = values.First(),
            Max = values.Last(),
            Median = values.Count % 2 == 0
                ? (values[values.Count / 2 - 1] + values[values.Count / 2]) / 2
                : values[values.Count / 2]
        };

        stat.Distribution = values
            .GroupBy(v => v)
            .OrderBy(g => g.Key)
            .Select(g => new HistogramBucketDto(g.Key.ToString(), g.Count()))
            .ToList();

        return stat;
    }

    private TextAnalyticsDto BuildTextAnalytics(List<Domain.ResponseAgg.ResponseAnswer> answers)
    {
        var texts = answers
            .Where(a => !a.IsSkipped && !string.IsNullOrWhiteSpace(a.TextAnswer))
            .Select(a => a.TextAnswer!)
            .ToList();

        return Services.PersianTextAnalyzer.Analyze(texts);
    }

    private List<TrendPointDto> BuildDateDistribution(List<Domain.ResponseAgg.ResponseAnswer> answers)
    {
        return answers
            .Where(a => a.DateAnswer.HasValue)
            .GroupBy(a => a.DateAnswer!.Value.Date)
            .OrderBy(g => g.Key)
            .Select(g => new TrendPointDto(g.Key.ToString("yyyy/MM/dd"), g.Count()))
            .ToList();
    }

    private List<RankingStatDto> BuildRankingStats(
        List<Domain.ResponseAgg.ResponseAnswer> answers,
        List<Domain.QuestionAgg.QuestionOption> options)
    {
        var stats = new List<RankingStatDto>();

        for (var i = 0; i < options.Count; i++)
        {
            var option = options[i];
            var ranks = new List<int>();

            foreach (var answer in answers)
            {
                var ranking = ParseJsonList<int>(answer.RankingAnswers);
                if (ranking != null && i < ranking.Count)
                    ranks.Add(ranking[i]);
            }

            if (ranks.Any())
                stats.Add(new RankingStatDto(option.OptionText, Math.Round((decimal)ranks.Average(), 2), ranks.Count));
        }

        return stats.OrderBy(s => s.AverageRank).ToList();
    }

    public async Task<Result<ParticipantsReportDto>> Handle(GetSurveyParticipantsRequest request)
    {
        var survey = await context.Surveys.AsNoTracking().FirstOrDefaultAsync(s => s.Guid == request.SurveyGuid);
        if (survey == null)
            return Result<ParticipantsReportDto>.Failure(null, "نظرسنجی یافت نشد.");
        if (!await CanViewResultsAsync(survey.Id))
            return Result<ParticipantsReportDto>.Failure(null, "شما به نتایج این نظرسنجی دسترسی ندارید.");

        var userGuids = await context.SurveyParticipants
            .Where(p => p.SurveyId == survey.Id)
            .Select(p => (Guid?)p.UserGuid)
            .ToListAsync();

        var participants = new List<ParticipantListDto>();

        if (userGuids.Count > 0)
        {
            var users = await userManagementAclService.GetUsersByGuidsAsync(userGuids);

            participants = users
                .Select(u => new ParticipantListDto
                {
                    PersonnelCode = u.UserName, // UserViewHelper.UserName = PersonnelCode
                    FullName = u.Fullname
                })
                .OrderBy(p => p.FullName)
                .ToList();
        }

        return Result<ParticipantsReportDto>.Success(new ParticipantsReportDto
        {
            SurveyTitle = survey.Title,
            Participants = participants
        });
    }

    #endregion
}