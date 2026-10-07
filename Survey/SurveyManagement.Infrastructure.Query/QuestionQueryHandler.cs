using Epc.Application.Query;
using Epc.Company.Query;
using Microsoft.EntityFrameworkCore;
using SurveyManagement.Common;
using SurveyManagement.Common.Extensions;
using SurveyManagement.Infrastructure.Persistence;
using SurveyManagement.Infrastructure.Query.Contract.Question;
using System.Text.Json;

namespace SurveyManagement.Infrastructure.Query;

public class QuestionQueryHandler :
    IQueryHandlerAsync<Result<List<QuestionListDto>>, GetQuestionListRequest>,
    IQueryHandlerAsync<Result<QuestionDetailDto>, Guid>,
    IQueryHandlerAsync<Result<List<QuestionDetailDto>>, GetQuestionsForResponseRequest>,
    IQueryHandlerAsync<Result<QuestionStatisticsDto>, GetQuestionStatisticsRequest>
{
    private readonly SurveyManagementQueryContext _context;

    public QuestionQueryHandler(SurveyManagementQueryContext context)
    {
        _context = context;
    }

    /// <summary>
    /// لیست ساده سوالات یک نظرسنجی
    /// </summary>
    public async Task<Result<List<QuestionListDto>>> Handle(GetQuestionListRequest request)
    {
        var survey = await _context.Surveys.FirstOrDefaultAsync(s => s.Guid == request.SurveyId);
        if (survey == null)
            return Result<List<QuestionListDto>>.Failure(null, "نظرسنجی یافت نشد.");

        var questions = await _context.Questions
            .Where(q => q.SurveyId == survey.Id && !q.IsRemoved)
            .OrderBy(q => q.SortOrder)
            .Select(q => new QuestionListDto
            {
                Guid = q.Guid,
                QuestionText = q.QuestionText,
                QuestionType = q.QuestionType.GetDisplayName(),
                QuestionTypeEnum = q.QuestionType,
                SortOrder = q.SortOrder,
                IsRequired = q.IsRequired,
                HelpText = q.HelpText,
                TotalOptions = q.Options.Count(o => o.IsActive == 1),
                HasLogic = q.QuestionLogics.Any(l => l.IsActive == 1)
            })
            .ToListAsync();

        return Result<List<QuestionListDto>>.Success(questions);
    }

    /// <summary>
    /// جزئیات کامل یک سوال
    /// </summary>
    public async Task<Result<QuestionDetailDto>> Handle(Guid questionGuid)
    {
        var question = await _context.Questions
            .Include(q => q.Options)
            .Include(q => q.QuestionLogics)
            .FirstOrDefaultAsync(q => q.Guid == questionGuid && !q.IsRemoved);

        if (question == null)
            return Result<QuestionDetailDto>.Failure(null, "سوال یافت نشد.");

        var questionDto = MapToDetailDto(question);
        return Result<QuestionDetailDto>.Success(questionDto);
    }

    /// <summary>
    /// تمام سوالات یک نظرسنجی با جزئیات (برای پاسخ‌دهی)
    /// </summary>
    public async Task<Result<List<QuestionDetailDto>>> Handle(GetQuestionsForResponseRequest request)
    {
        var survey = await _context.Surveys.FirstOrDefaultAsync(s => s.Guid == request.SurveyId);
        if (survey == null)
            return Result<List<QuestionDetailDto>>.Failure(null, "نظرسنجی یافت نشد.");

        var query = _context.Questions
            .Include(q => q.Options.Where(o => o.IsActive == 1))
            .Include(q => q.Criterion)          // ✅ اضافه شد
            .Where(q => q.SurveyId == survey.Id && !q.IsRemoved);

        if (request.IncludeLogic)
            query = query.Include(q => q.QuestionLogics.Where(l => l.IsActive == 1));

        var questions = await query
            .OrderBy(q => q.SortOrder)
            .ToListAsync();

        var result = questions.Select(MapToDetailDto).ToList();
        return Result<List<QuestionDetailDto>>.Success(result);
    }

    /// <summary>
    /// آمار و تحلیل پاسخ‌های یک سوال
    /// </summary>
    public async Task<Result<QuestionStatisticsDto>> Handle(GetQuestionStatisticsRequest request)
    {
        var question = await _context.Questions
            .Include(q => q.Options)
            .FirstOrDefaultAsync(q => q.Guid == request.QuestionId && !q.IsRemoved);

        if (question == null)
            return Result<QuestionStatisticsDto>.Failure(null, "سوال یافت نشد.");

        var answers = await _context.ResponseAnswers
            .Where(a => a.QuestionId == question.Id)
            .ToListAsync();

        var totalAnswers = answers.Count;
        var skippedCount = answers.Count(a => a.IsSkipped);

        var statistics = new QuestionStatisticsDto
        {
            QuestionGuid = question.Guid,
            QuestionText = question.QuestionText,
            QuestionType = question.QuestionType,
            TotalAnswers = totalAnswers,
            SkippedCount = skippedCount
        };

        switch (question.QuestionType)
        {
            case QuestionType.SingleChoice:
            case QuestionType.Dropdown:
            case QuestionType.YesNo:
                statistics.OptionStats = CalculateSingleChoiceStats(question, answers);
                break;

            case QuestionType.MultipleChoice:
                statistics.OptionStats = CalculateMultipleChoiceStats(question, answers);
                break;

            case QuestionType.Number:
            case QuestionType.Rating:
            case QuestionType.LinearScale:
            case QuestionType.NPS:
                var numericAnswers = answers
                    .Where(a => a.NumericAnswer.HasValue)
                    .Select(a => a.NumericAnswer!.Value)
                    .ToList();

                if (numericAnswers.Any())
                {
                    statistics.Average = numericAnswers.Average();
                    statistics.Min = numericAnswers.Min();
                    statistics.Max = numericAnswers.Max();
                }
                break;

            case QuestionType.ShortText:
            case QuestionType.LongText:
            case QuestionType.Email:
            case QuestionType.Phone:
            case QuestionType.Address:
                statistics.TextAnswers = answers
                    .Where(a => !string.IsNullOrEmpty(a.TextAnswer))
                    .Select(a => a.TextAnswer!)
                    .Take(100)
                    .ToList();
                break;
        }

        return Result<QuestionStatisticsDto>.Success(statistics);
    }

    #region Private Methods

    private QuestionDetailDto MapToDetailDto(Domain.QuestionAgg.Question question)
    {
        var dto = new QuestionDetailDto
        {
            Guid = question.Guid,
            QuestionText = question.QuestionText,
            QuestionType = question.QuestionType,
            SortOrder = question.SortOrder,
            IsRequired = question.IsRequired,
            HelpText = question.HelpText,
            Placeholder = question.Placeholder,
            RandomizeOptions = question.RandomizeOptions,
            AllowOtherOption = question.AllowOtherOption,
            OtherOptionText = question.OtherOptionText,
            ImageUrl = question.ImageUrl,
            VideoUrl = question.VideoUrl,
            ValidationType = question.ValidationType,
            ValidationErrorMessage = question.ValidationErrorMessage,
            CustomValidationRegex = question.CustomValidationRegex,
            MinLength = question.MinLength,
            MaxLength = question.MaxLength,
            MinValue = question.MinValue,
            MaxValue = question.MaxValue,
            MinSelections = question.MinSelections,
            MaxSelections = question.MaxSelections,
            MaxFileSize = question.MaxFileSize,
            AllowedFileTypes = question.AllowedFileTypes,
            MinScaleLabel = question.MinScaleLabel,
            MaxScaleLabel = question.MaxScaleLabel,
            CriterionGuid = question.Criterion?.Guid, // ✅ اضافه شد
        };

        if (!string.IsNullOrEmpty(question.MatrixRows))
        {
            try
            {
                dto.MatrixRows = JsonSerializer.Deserialize<List<string>>(question.MatrixRows);
            }
            catch { }
        }

        if (!string.IsNullOrEmpty(question.MatrixColumns))
        {
            try
            {
                dto.MatrixColumns = JsonSerializer.Deserialize<List<string>>(question.MatrixColumns);
            }
            catch { }
        }

        dto.Options = question.Options
            .Where(o => o.IsActive == 1)
            .OrderBy(o => o.SortOrder)
            .Select(o => new QuestionOptionDetailDto
            {
                Guid = o.Guid,
                OptionText = o.OptionText,
                SortOrder = o.SortOrder,
                Value = o.Value,
                ImageUrl = o.ImageFile,
                Color = o.Color
            })
            .ToList();

        dto.Logics = question.QuestionLogics
            .Where(l => l.IsActive == 1)
            .OrderBy(l => l.Priority)
            .Select(l => new QuestionLogicDetailDto
            {
                Id = l.Id,
                TargetQuestionId = l.TargetQuestionId,
                LogicType = l.LogicType.GetDisplayName(),
                LogicTypeEnum = l.LogicType,
                ConditionOperator = l.ConditionOperator.GetDisplayName(),
                ConditionOperatorEnum = l.ConditionOperator,
                ConditionValue = l.ConditionValue,
                OptionId = l.OptionId,
                Priority = l.Priority
            })
            .ToList();

        return dto;
    }

    private List<OptionStatDto> CalculateSingleChoiceStats(
        Domain.QuestionAgg.Question question,
        List<Domain.ResponseAgg.ResponseAnswer> answers)
    {
        var totalAnswers = answers.Count(a => a.SelectedOptionId.HasValue);
        if (totalAnswers == 0)
            return new List<OptionStatDto>();

        var optionCounts = answers
            .Where(a => a.SelectedOptionId.HasValue)
            .GroupBy(a => a.SelectedOptionId!.Value)
            .ToDictionary(g => g.Key, g => g.Count());

        var stats = new List<OptionStatDto>();

        foreach (var option in question.Options.Where(o => o.IsActive == 1))
        {
            var count = optionCounts.TryGetValue(option.Id, out var c) ? c : 0;
            var percentage = (decimal)count / totalAnswers * 100;

            stats.Add(new OptionStatDto
            {
                OptionId = option.Id,
                OptionText = option.OptionText,
                Count = count,
                Percentage = Math.Round(percentage, 2)
            });
        }

        var otherCount = answers.Count(a => !string.IsNullOrEmpty(a.OtherAnswer));
        if (otherCount > 0)
        {
            var percentage = (decimal)otherCount / totalAnswers * 100;
            stats.Add(new OptionStatDto
            {
                OptionId = 0,
                OptionText = "سایر",
                Count = otherCount,
                Percentage = Math.Round(percentage, 2)
            });
        }

        return stats;
    }

    private List<OptionStatDto> CalculateMultipleChoiceStats(
        Domain.QuestionAgg.Question question,
        List<Domain.ResponseAgg.ResponseAnswer> answers)
    {
        var totalAnswers = answers.Count;
        if (totalAnswers == 0)
            return new List<OptionStatDto>();

        var optionCounts = new Dictionary<long, int>();

        foreach (var answer in answers.Where(a => !string.IsNullOrEmpty(a.SelectedOptionIds)))
        {
            try
            {
                var selectedIds = JsonSerializer.Deserialize<List<long>>(answer.SelectedOptionIds!);
                if (selectedIds != null)
                {
                    foreach (var optionId in selectedIds)
                    {
                        if (!optionCounts.ContainsKey(optionId))
                            optionCounts[optionId] = 0;
                        optionCounts[optionId]++;
                    }
                }
            }
            catch { }
        }

        var stats = new List<OptionStatDto>();

        foreach (var option in question.Options.Where(o => o.IsActive == 1))
        {
            var count = optionCounts.TryGetValue(option.Id, out var c) ? c : 0;
            var percentage = (decimal)count / totalAnswers * 100;

            stats.Add(new OptionStatDto
            {
                OptionId = option.Id,
                OptionText = option.OptionText,
                Count = count,
                Percentage = Math.Round(percentage, 2)
            });
        }

        var otherCount = answers.Count(a => !string.IsNullOrEmpty(a.OtherAnswer));
        if (otherCount > 0)
        {
            var percentage = (decimal)otherCount / totalAnswers * 100;
            stats.Add(new OptionStatDto
            {
                OptionId = 0,
                OptionText = "سایر",
                Count = otherCount,
                Percentage = Math.Round(percentage, 2)
            });
        }

        return stats;
    }

    #endregion
}
