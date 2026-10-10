using System.Globalization;
using System.Text.Json;
using SurveyManagement.Common;
using SurveyManagement.Domain.QuestionAgg;
using SurveyManagement.Domain.ResponseAgg;

namespace SurveyManagement.Application.Responses;

/// <summary>
/// منطق شرطی سوال‌ها (نمایش/پنهان/پرش/پایان) — همان قواعدی که صفحه‌ی پاسخ‌دهی در فرانت اجرا می‌کند.
/// ─────────────────────────────────────────────────────────────────────────
/// قبلاً منطق در صفحه‌ی پاسخ‌دهی اصلاً اجرا نمی‌شد و سرور هم سوال اجباریِ پنهان‌شده را «بی‌پاسخ» می‌دانست.
/// قواعد:
///  • سوال‌ها به ترتیب SortOrder پیمایش می‌شوند؛ منطقِ سوالی که خودش مرتبط نیست اجرا نمی‌شود.
///  • ShowQuestion: سوال هدف فقط وقتی دیده می‌شود که حداقل یکی از شرط‌های نمایشش برقرار باشد.
///  • HideQuestion: با برقراری شرط، سوال هدف پنهان می‌شود.
///  • SkipToQuestion: سوال‌های بین مبدأ و هدف رد می‌شوند. EndSurvey: همه‌ی سوال‌های بعدی رد می‌شوند.
/// </summary>
public static class SurveyLogicEngine
{
    public static HashSet<long> RelevantQuestionIds(IReadOnlyCollection<Question> questions, IEnumerable<ResponseAnswer> answers)
    {
        var ordered = questions.OrderBy(q => q.SortOrder).ThenBy(q => q.Id).ToList();
        var byQuestion = answers.Where(a => !a.IsSkipped).GroupBy(a => a.QuestionId).ToDictionary(g => g.Key, g => g.Last());
        var index = ordered.Select((q, i) => (q.Id, i)).ToDictionary(x => x.Id, x => x.i);
        var logics = ordered.SelectMany(q => q.QuestionLogics ?? []).ToList();

        var showTargets = logics.Where(l => l.LogicType == LogicType.ShowQuestion && l.TargetQuestionId.HasValue)
            .Select(l => l.TargetQuestionId!.Value).ToHashSet();
        var shown = new HashSet<long>();
        var hidden = new HashSet<long>();
        var relevant = new HashSet<long>();
        var skipUntil = -1;   // اندیس سوال هدف پرش
        var ended = false;

        for (var i = 0; i < ordered.Count; i++)
        {
            var q = ordered[i];
            if (ended || i < skipUntil) continue;
            if (hidden.Contains(q.Id) || (showTargets.Contains(q.Id) && !shown.Contains(q.Id))) continue;

            relevant.Add(q.Id);
            byQuestion.TryGetValue(q.Id, out var answer);

            foreach (var logic in (q.QuestionLogics ?? []).OrderBy(l => l.Priority))
            {
                if (!Matches(logic, answer)) continue;
                var target = logic.TargetQuestionId;
                switch (logic.LogicType)
                {
                    case LogicType.ShowQuestion when target.HasValue:
                        shown.Add(target.Value);
                        break;
                    case LogicType.HideQuestion when target.HasValue:
                        hidden.Add(target.Value);
                        break;
                    case LogicType.SkipToQuestion when target.HasValue && index.TryGetValue(target.Value, out var t) && t > i:
                        skipUntil = Math.Max(skipUntil, t);
                        break;
                    case LogicType.EndSurvey:
                        ended = true;
                        break;
                }
            }
        }
        return relevant;
    }

    public static bool Matches(QuestionLogic logic, ResponseAnswer? answer)
    {
        var answered = answer is not null && !answer.IsSkipped && HasValue(answer);
        switch (logic.ConditionOperator)
        {
            case ConditionOperator.IsAnswered: return answered;
            case ConditionOperator.IsNotAnswered: return !answered;
        }
        if (!answered) return false;

        var optionIds = OptionIds(answer!);
        var text = Text(answer!);
        var value = logic.ConditionValue?.Trim() ?? string.Empty;
        var number = Number(answer!);
        decimal.TryParse(ToLatin(value), NumberStyles.Number, CultureInfo.InvariantCulture, out var target);

        return logic.ConditionOperator switch
        {
            ConditionOperator.Equals => logic.OptionId is { } o ? optionIds.Contains(o)
                : number.HasValue && value.Length > 0 && decimal.TryParse(ToLatin(value), NumberStyles.Number, CultureInfo.InvariantCulture, out var eq) ? number.Value == eq
                : string.Equals(text, value, StringComparison.OrdinalIgnoreCase),
            ConditionOperator.NotEquals => logic.OptionId is { } o2 ? !optionIds.Contains(o2)
                : number.HasValue && decimal.TryParse(ToLatin(value), NumberStyles.Number, CultureInfo.InvariantCulture, out var ne) ? number.Value != ne
                : !string.Equals(text, value, StringComparison.OrdinalIgnoreCase),
            ConditionOperator.Contains => logic.OptionId is { } o3 ? optionIds.Contains(o3) : text.Contains(value, StringComparison.OrdinalIgnoreCase),
            ConditionOperator.NotContains => logic.OptionId is { } o4 ? !optionIds.Contains(o4) : !text.Contains(value, StringComparison.OrdinalIgnoreCase),
            ConditionOperator.GreaterThan => number.HasValue && number.Value > target,
            ConditionOperator.LessThan => number.HasValue && number.Value < target,
            _ => false
        };
    }

    private static bool HasValue(ResponseAnswer a) =>
        !string.IsNullOrWhiteSpace(a.TextAnswer) || a.NumericAnswer.HasValue || a.DateAnswer.HasValue ||
        a.SelectedOptionId.HasValue || !string.IsNullOrWhiteSpace(a.SelectedOptionIds) || !string.IsNullOrWhiteSpace(a.OtherAnswer) ||
        !string.IsNullOrWhiteSpace(a.FileUrl) || !string.IsNullOrWhiteSpace(a.MatrixAnswers) || !string.IsNullOrWhiteSpace(a.RankingAnswers);

    private static HashSet<long> OptionIds(ResponseAnswer a)
    {
        var set = new HashSet<long>();
        if (a.SelectedOptionId is { } id) set.Add(id);
        if (!string.IsNullOrWhiteSpace(a.SelectedOptionIds))
        {
            try { foreach (var x in JsonSerializer.Deserialize<List<long>>(a.SelectedOptionIds) ?? []) set.Add(x); }
            catch (JsonException) { }
        }
        return set;
    }

    private static string Text(ResponseAnswer a) => (a.TextAnswer ?? a.OtherAnswer ?? string.Empty).Trim();

    private static decimal? Number(ResponseAnswer a)
    {
        if (a.NumericAnswer.HasValue) return a.NumericAnswer;
        return decimal.TryParse(ToLatin(a.TextAnswer ?? string.Empty), NumberStyles.Number, CultureInfo.InvariantCulture, out var n) ? n : null;
    }

    private static string ToLatin(string s)
    {
        var chars = s.ToCharArray();
        for (var i = 0; i < chars.Length; i++)
        {
            if (chars[i] is >= '۰' and <= '۹') chars[i] = (char)('0' + (chars[i] - '۰'));
            else if (chars[i] is >= '٠' and <= '٩') chars[i] = (char)('0' + (chars[i] - '٠'));
        }
        return new string(chars);
    }
}
