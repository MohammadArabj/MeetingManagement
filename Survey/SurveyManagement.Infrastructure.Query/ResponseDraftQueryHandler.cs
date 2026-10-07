using System.Globalization;
using System.Text.Json;
using Epc.Application.Query;
using Epc.Company.Query;
using Microsoft.EntityFrameworkCore;
using SurveyManagement.Common;
using SurveyManagement.Domain.Shared.Access;
using SurveyManagement.Infrastructure.Persistence;
using SurveyManagement.Infrastructure.Query.Contract.Response;
using SurveyManagement.Infrastructure.Query.Contract.SurveyAccess;

namespace SurveyManagement.Infrastructure.Query;

/// <summary>
/// وضعیت پاسخ‌دهی و پیش‌نویس کاربر جاری. کاربر همیشه از توکن خوانده می‌شود؛ UserGuid درخواست نادیده
/// گرفته می‌شود (قبلاً با هر شناسه‌ای و حتی بدون ورود، شرکت هر شخص در هر نظرسنجی قابل استعلام بود).
/// </summary>
public class ResponseDraftQueryHandler(
    SurveyManagementQueryContext context,
    ISurveyAccessService access,
    IResponseDraftKeys draftKeys) :
    IQueryHandlerAsync<Result<UserResponseStatusDto>, GetUserResponseStatusRequest>,
    IQueryHandlerAsync<Result<UserDraftResponseDto>, GetUserDraftRequest>
{
    public async Task<Result<UserResponseStatusDto>> Handle(GetUserResponseStatusRequest request)
    {
        var survey = await context.Surveys.AsNoTracking()
            .Where(s => s.Guid == request.SurveyGuid && !s.IsRemoved)
            .Select(s => new { s.Id, s.AllowMultipleResponses })
            .FirstOrDefaultAsync();
        if (survey == null)
            return Result<UserResponseStatusDto>.Failure(null, "نظرسنجی یافت نشد.");

        var identity = await access.IdentityAsync();
        if (!identity.IsAuthenticated)
            return Result<UserResponseStatusDto>.Success(new UserResponseStatusDto { CanRespond = true });

        var hasParticipated = await context.SurveyParticipants.AsNoTracking()
            .AnyAsync(p => p.SurveyId == survey.Id && p.UserGuid == identity.UserGuid);

        var key = draftKeys.For(survey.Id, identity.UserGuid);
        var draft = await context.Responses.AsNoTracking()
            .Where(r => r.Guid == key && r.SurveyId == survey.Id && r.Status == ResponseStatus.InProgress)
            .Select(r => new { Answered = r.Answers.Count(a => !a.IsSkipped) })
            .FirstOrDefaultAsync();

        var total = draft is null ? 0 : await context.Questions.CountAsync(q => q.SurveyId == survey.Id && !q.IsRemoved);

        return Result<UserResponseStatusDto>.Success(new UserResponseStatusDto
        {
            HasParticipated = hasParticipated,
            HasDraft = draft is not null,
            DraftProgressPercentage = draft is null || total == 0 ? 0 : (int)Math.Round(draft.Answered * 100.0 / total),
            CanRespond = !hasParticipated || survey.AllowMultipleResponses
        });
    }

    public async Task<Result<UserDraftResponseDto>> Handle(GetUserDraftRequest request)
    {
        var identity = await access.IdentityAsync();
        if (!identity.IsAuthenticated)
            return Result<UserDraftResponseDto>.Success(null!);

        var surveyId = await context.Surveys.AsNoTracking()
            .Where(s => s.Guid == request.SurveyId && !s.IsRemoved)
            .Select(s => s.Id)
            .FirstOrDefaultAsync();
        if (surveyId == 0)
            return Result<UserDraftResponseDto>.Failure(null, "نظرسنجی یافت نشد.");

        var key = draftKeys.For(surveyId, identity.UserGuid);
        var draft = await context.Responses.AsNoTracking()
            .Include(r => r.Answers)
            .FirstOrDefaultAsync(r => r.Guid == key && r.SurveyId == surveyId && r.Status == ResponseStatus.InProgress);
        if (draft is null)
            return Result<UserDraftResponseDto>.Success(null!, "پیش‌نویسی وجود ندارد.");

        var questions = await context.Questions.AsNoTracking()
            .Where(q => q.SurveyId == surveyId && !q.IsRemoved)
            .OrderBy(q => q.SortOrder)
            .Select(q => new { q.Id, q.Guid, Options = q.Options.Select(o => new { o.Id, o.Guid }).ToList() })
            .ToListAsync();
        var questionById = questions.ToDictionary(q => q.Id);
        var optionGuid = questions.SelectMany(q => q.Options).GroupBy(o => o.Id).ToDictionary(g => g.Key, g => g.First().Guid);

        var saved = new List<SavedAnswerDto>();
        foreach (var a in draft.Answers.Where(a => !a.IsSkipped))
        {
            if (!questionById.TryGetValue(a.QuestionId, out var q)) continue;
            saved.Add(new SavedAnswerDto
            {
                QuestionGuid = q.Guid,
                TextAnswer = a.TextAnswer,
                NumericAnswer = a.NumericAnswer,
                DateAnswer = a.DateAnswer?.ToString("yyyy/MM/dd", new CultureInfo("fa-IR")),
                SelectedOptionGuid = a.SelectedOptionId is { } id && optionGuid.TryGetValue(id, out var g) ? g : null,
                SelectedOptionGuids = ParseIds(a.SelectedOptionIds).Where(optionGuid.ContainsKey).Select(i => optionGuid[i]).ToList(),
                OtherAnswer = a.OtherAnswer,
                FileUrl = a.FileUrl,
                FileName = a.FileName,
                FileSize = a.FileSize,
                MatrixAnswers = Deserialize<Dictionary<string, string>>(a.MatrixAnswers),
                RankingAnswers = Deserialize<List<int>>(a.RankingAnswers),
                AnsweredAt = a.AnsweredAt.ToString("yyyy/MM/dd HH:mm", new CultureInfo("fa-IR"))
            });
        }

        var answeredIds = draft.Answers.Where(a => !a.IsSkipped).Select(a => a.QuestionId).ToHashSet();
        var lastSaved = draft.Answers.Count == 0 ? draft.StartedAt : draft.Answers.Max(a => a.AnsweredAt);

        return Result<UserDraftResponseDto>.Success(new UserDraftResponseDto
        {
            SurveyGuid = request.SurveyId,
            AnsweredCount = answeredIds.Count,
            TotalQuestions = questions.Count,
            ProgressPercentage = questions.Count == 0 ? 0 : Math.Round(answeredIds.Count * 100m / questions.Count),
            StartedAt = draft.StartedAt.ToString("yyyy/MM/dd HH:mm", new CultureInfo("fa-IR")),
            LastSavedAt = lastSaved.ToString("yyyy/MM/dd HH:mm", new CultureInfo("fa-IR")),
            ResumeQuestionGuid = questions.FirstOrDefault(q => !answeredIds.Contains(q.Id))?.Guid,
            SavedAnswers = saved
        });
    }

    private static List<long> ParseIds(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new();
        try { return JsonSerializer.Deserialize<List<long>>(json) ?? new(); }
        catch (JsonException) { return new(); }
    }

    private static T? Deserialize<T>(string? json) where T : class
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return JsonSerializer.Deserialize<T>(json); }
        catch (JsonException) { return null; }
    }
}
