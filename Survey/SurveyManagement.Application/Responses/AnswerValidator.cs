using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using SurveyManagement.Application.Contract.Response;
using SurveyManagement.Common;
using SurveyManagement.Domain.QuestionAgg;
using SurveyManagement.Domain.ResponseAgg;

namespace SurveyManagement.Application.Responses;

/// <summary>
/// اعتبارسنجی سمت سرور هر پاسخ بر اساس تعریف خود سوال (نه داده‌ی کلاینت).
/// ─────────────────────────────────────────────────────────────────────────
/// قبلاً نوع سوال از کلاینت خوانده می‌شد، سوال/گزینه‌ی نظرسنجی‌های دیگر پذیرفته می‌شد، یک سوال
/// چند بار پاسخ می‌گرفت و «اجباری» فقط وجود شیء پاسخ را بررسی می‌کرد (پاسخ خالی هم قبول بود).
/// </summary>
public sealed class AnswerValidator(IReadOnlyCollection<Question> questions)
{
    private const int MaxTextLength = 4000;
    private static readonly Regex EmailRegex = new(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.Compiled);
    private static readonly Regex PhoneRegex = new(@"^\+?[0-9\-\s()]{7,20}$", RegexOptions.Compiled);
    private static readonly Regex IsoDate = new(@"^\d{4}-\d{2}-\d{2}", RegexOptions.Compiled);
    private static readonly Regex SlashDate = new(@"^(\d{4})/(\d{1,2})/(\d{1,2})", RegexOptions.Compiled);
    private static readonly Regex TimeOnly = new(@"^\d{1,2}:\d{2}(:\d{2})?$", RegexOptions.Compiled);

    private readonly Dictionary<Guid, Question> _byGuid = questions.ToDictionary(q => q.Guid);

    public IReadOnlyCollection<Question> Questions => questions;

    public bool TryGetQuestion(Guid guid, out Question question) => _byGuid.TryGetValue(guid, out question!);

    /// <summary>
    /// تبدیل پاسخ به ResponseAnswer معتبر.
    /// null با error=null یعنی «پاسخی داده نشده» (خالی/رد شده). null با error یعنی مقدار نامعتبر.
    /// </summary>
    public ResponseAnswer? Build(Question question, ResponseAnswerDto dto, out string? error)
    {
        error = null;
        if (dto.IsSkipped) return null;

        var time = dto.TimeSpentSeconds is { } t ? Math.Clamp(t, 0, 86_400) : (int?)null;
        var answer = new ResponseAnswer(0, question.Id, question.QuestionType);
        var options = question.Options.GroupBy(o => o.Guid).ToDictionary(g => g.Key, g => g.First());

        switch (question.QuestionType)
        {
            case QuestionType.ShortText:
            case QuestionType.LongText:
            case QuestionType.Email:
            case QuestionType.Phone:
            case QuestionType.Address:
            {
                var text = dto.TextAnswer?.Trim();
                if (string.IsNullOrEmpty(text)) return null;
                error = ValidateText(question, text);
                if (error is not null) return null;
                answer.SetTextAnswer(text, time);
                return answer;
            }

            case QuestionType.Number:
            case QuestionType.Rating:
            case QuestionType.LinearScale:
            case QuestionType.NPS:
            {
                var value = dto.NumericAnswer;
                if (value is null && decimal.TryParse(dto.TextAnswer, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed))
                    value = parsed;
                if (value is null) return null;

                var (min, max) = NumericRange(question);
                if ((min.HasValue && value < min) || (max.HasValue && value > max))
                {
                    error = $"مقدار باید بین {min?.ToString("0.##") ?? "-"} و {max?.ToString("0.##") ?? "-"} باشد.";
                    return null;
                }
                answer.SetNumericAnswer(value.Value, time);
                return answer;
            }

            case QuestionType.Date:
            case QuestionType.Time:
            {
                var raw = dto.DateAnswer?.Trim();
                if (string.IsNullOrEmpty(raw)) return null;
                var date = ParseDate(raw);
                if (date is null)
                {
                    // سوال «زمان» با مقدار ساعت
                    if (TimeOnly.IsMatch(raw) && TimeSpan.TryParse(raw, CultureInfo.InvariantCulture, out var ts))
                        date = DateTime.Today.Date.Add(ts);
                    else
                    {
                        error = "تاریخ واردشده معتبر نیست.";
                        return null;
                    }
                }
                answer.SetDateAnswer(date.Value, time);
                return answer;
            }

            case QuestionType.SingleChoice:
            case QuestionType.Dropdown:
            case QuestionType.YesNo:
            {
                var other = question.AllowOtherOption ? Limit(dto.OtherAnswer) : null;
                if (dto.SelectedOptionGuid is { } selected)
                {
                    if (!options.TryGetValue(selected, out var option))
                    {
                        error = "گزینه‌ی انتخاب‌شده متعلق به این سوال نیست.";
                        return null;
                    }
                    answer.SetSelectedOption(option.Id, other, time);
                    return answer;
                }
                if (!string.IsNullOrEmpty(other))
                {
                    answer.SetOtherAnswer(other, time);
                    return answer;
                }
                return null;
            }

            case QuestionType.MultipleChoice:
            {
                var selected = (dto.SelectedOptionGuids ?? new()).Distinct().ToList();
                if (selected.Any(g => !options.ContainsKey(g)))
                {
                    error = "گزینه‌ی انتخاب‌شده متعلق به این سوال نیست.";
                    return null;
                }
                var other = question.AllowOtherOption ? Limit(dto.OtherAnswer) : null;
                var count = selected.Count + (string.IsNullOrEmpty(other) ? 0 : 1);
                if (count == 0) return null;
                if (question.MinSelections is > 0 && count < question.MinSelections)
                {
                    error = $"حداقل {question.MinSelections} گزینه انتخاب کنید.";
                    return null;
                }
                if (question.MaxSelections is > 0 && count > question.MaxSelections)
                {
                    error = $"حداکثر {question.MaxSelections} گزینه می‌توانید انتخاب کنید.";
                    return null;
                }
                var ids = selected.Select(g => options[g].Id).ToList();
                if (ids.Count == 0) answer.SetOtherAnswer(other!, time);
                else answer.SetSelectedOptions(JsonSerializer.Serialize(ids), other, time);
                return answer;
            }

            case QuestionType.FileUpload:
            {
                if (string.IsNullOrWhiteSpace(dto.FileUrl) || string.IsNullOrWhiteSpace(dto.FileName)) return null;
                if (!IsSafeFileReference(dto.FileUrl))
                {
                    error = "نشانی فایل معتبر نیست.";
                    return null;
                }
                var size = Math.Max(0, dto.FileSize ?? 0);
                if (question.MaxFileSize is > 0 && size > (long)question.MaxFileSize.Value * 1024 * 1024)
                {
                    error = $"حجم فایل بیش از {question.MaxFileSize} مگابایت است.";
                    return null;
                }
                if (!IsAllowedFileType(question.AllowedFileTypes, dto.FileName))
                {
                    error = "نوع فایل مجاز نیست.";
                    return null;
                }
                answer.SetFileAnswer(Limit(dto.FileUrl, 1000)!, Limit(dto.FileName, 260)!, size, time);
                return answer;
            }

            case QuestionType.MatrixSingle:
            case QuestionType.MatrixMultiple:
            {
                var values = (dto.MatrixAnswers ?? new())
                    .Where(kv => !string.IsNullOrWhiteSpace(kv.Key) && !string.IsNullOrWhiteSpace(kv.Value))
                    .ToDictionary(kv => kv.Key.Trim(), kv => kv.Value.Trim());
                if (values.Count == 0) return null;

                var rows = ParseList(question.MatrixRows);
                var columns = ParseList(question.MatrixColumns);
                if (rows.Count > 0 && values.Keys.Any(k => !rows.Contains(k)))
                {
                    error = "ردیف نامعتبر در پاسخ ماتریسی.";
                    return null;
                }
                if (columns.Count > 0 && values.Values
                        .SelectMany(v => question.QuestionType == QuestionType.MatrixMultiple ? v.Split(',', StringSplitOptions.TrimEntries) : [v])
                        .Any(v => !columns.Contains(v)))
                {
                    error = "ستون نامعتبر در پاسخ ماتریسی.";
                    return null;
                }
                answer.SetMatrixAnswers(JsonSerializer.Serialize(values), time);
                return answer;
            }

            case QuestionType.Ranking:
            {
                var ranking = dto.RankingAnswers ?? new();
                if (ranking.Count == 0) return null;
                answer.SetRankingAnswers(JsonSerializer.Serialize(ranking.Take(200)), time);
                return answer;
            }
        }

        return null;
    }

    /// <summary>سوال اجباری بدون پاسخ کامل (برای ماتریس: همه‌ی ردیف‌ها)</summary>
    public bool IsComplete(Question question, ResponseAnswer? answer)
    {
        if (answer is null || answer.IsSkipped) return false;
        if (question.QuestionType is QuestionType.MatrixSingle or QuestionType.MatrixMultiple)
        {
            var rows = ParseList(question.MatrixRows);
            if (rows.Count == 0) return true;
            try
            {
                var values = JsonSerializer.Deserialize<Dictionary<string, string>>(answer.MatrixAnswers ?? "{}") ?? new();
                return rows.All(values.ContainsKey);
            }
            catch { return false; }
        }
        return true;
    }

    // ───────────────────────────── Helpers ─────────────────────────────

    private static string? ValidateText(Question q, string text)
    {
        if (text.Length > MaxTextLength) return $"حداکثر {MaxTextLength} نویسه مجاز است.";
        if (q.MinLength is > 0 && text.Length < q.MinLength) return $"حداقل {q.MinLength} نویسه وارد کنید.";
        if (q.MaxLength is > 0 && text.Length > q.MaxLength) return $"حداکثر {q.MaxLength} نویسه مجاز است.";

        var custom = string.IsNullOrWhiteSpace(q.ValidationErrorMessage) ? null : q.ValidationErrorMessage;
        if (q.QuestionType == QuestionType.Email && !EmailRegex.IsMatch(text)) return custom ?? "ایمیل معتبر نیست.";
        if (q.QuestionType == QuestionType.Phone && !PhoneRegex.IsMatch(ToLatinDigits(text))) return custom ?? "شماره تلفن معتبر نیست.";

        var latin = ToLatinDigits(text);
        return q.ValidationType switch
        {
            ValidationType.Email when !EmailRegex.IsMatch(text) => custom ?? "ایمیل معتبر نیست.",
            ValidationType.Phone when !PhoneRegex.IsMatch(latin) => custom ?? "شماره تلفن معتبر نیست.",
            ValidationType.NationalCode when !IsNationalCode(latin) => custom ?? "کد ملی معتبر نیست.",
            ValidationType.Number when !decimal.TryParse(latin, NumberStyles.Number, CultureInfo.InvariantCulture, out _) => custom ?? "فقط عدد وارد کنید.",
            ValidationType.NumberRange when !InRange(q, latin) => custom ?? "عدد خارج از بازه‌ی مجاز است.",
            ValidationType.Url when !Uri.TryCreate(text, UriKind.Absolute, out var u) || (u.Scheme != Uri.UriSchemeHttp && u.Scheme != Uri.UriSchemeHttps) => custom ?? "نشانی وب معتبر نیست.",
            ValidationType.CustomRegex when !MatchesCustom(q.CustomValidationRegex, text) => custom ?? "قالب پاسخ صحیح نیست.",
            _ => null
        };
    }

    private static bool InRange(Question q, string latin) =>
        decimal.TryParse(latin, NumberStyles.Number, CultureInfo.InvariantCulture, out var v)
        && (!q.MinValue.HasValue || v >= q.MinValue) && (!q.MaxValue.HasValue || v <= q.MaxValue);

    private static bool MatchesCustom(string? pattern, string text)
    {
        if (string.IsNullOrWhiteSpace(pattern)) return true;
        try { return Regex.IsMatch(text, pattern, RegexOptions.None, TimeSpan.FromMilliseconds(200)); }
        catch (ArgumentException) { return true; }            // الگوی نامعتبر از طراح نظرسنجی؛ پاسخ‌دهنده را مسدود نمی‌کنیم
        catch (RegexMatchTimeoutException) { return false; }
    }

    private static (decimal? Min, decimal? Max) NumericRange(Question q) => q.QuestionType switch
    {
        QuestionType.Rating => (q.MinValue ?? 1, q.MaxValue ?? 10),
        QuestionType.LinearScale => (q.MinValue ?? 0, q.MaxValue ?? 10),
        QuestionType.NPS => (0, 10),
        _ => (q.MinValue, q.MaxValue)
    };

    /// <summary>ISO (میلادی) یا yyyy/MM/dd شمسی؛ سال کمتر از ۱۷۰۰ شمسی فرض می‌شود</summary>
    internal static DateTime? ParseDate(string raw)
    {
        raw = ToLatinDigits(raw);
        if (IsoDate.IsMatch(raw) && DateTime.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var iso))
            return iso;

        var m = SlashDate.Match(raw);
        if (!m.Success) return null;
        var (y, mo, d) = (int.Parse(m.Groups[1].Value), int.Parse(m.Groups[2].Value), int.Parse(m.Groups[3].Value));
        try
        {
            return y < 1700
                ? new PersianCalendar().ToDateTime(y, mo, d, 0, 0, 0, 0)
                : new DateTime(y, mo, d);
        }
        catch (ArgumentOutOfRangeException) { return null; }
    }

    private static bool IsSafeFileReference(string url)
    {
        url = url.Trim();
        if (Guid.TryParse(url, out _)) return true;
        if (url.StartsWith('/') && !url.StartsWith("//")) return true;
        return Uri.TryCreate(url, UriKind.Absolute, out var u) && (u.Scheme == Uri.UriSchemeHttps || u.Scheme == Uri.UriSchemeHttp);
    }

    private static bool IsAllowedFileType(string? allowed, string fileName)
    {
        if (string.IsNullOrWhiteSpace(allowed)) return true;
        var ext = Path.GetExtension(fileName).TrimStart('.').ToLowerInvariant();
        var list = allowed.Split([',', '،', ';', ' ', '|'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(x => x.TrimStart('.').ToLowerInvariant())
            .ToList();
        return list.Count == 0 || list.Contains(ext) || list.Any(x => x.Contains('/'));
    }

    /// <summary>ردیف/ستون‌های ماتریس: JSON array یا جداشده با کاما/خط جدید</summary>
    internal static List<string> ParseList(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return new();
        raw = raw.Trim();
        if (raw.StartsWith('['))
        {
            try { return (JsonSerializer.Deserialize<List<string>>(raw) ?? new()).Select(x => x.Trim()).Where(x => x.Length > 0).ToList(); }
            catch (JsonException) { }
        }
        return raw.Split([',', '،', '\n', '\r', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
    }

    private static bool IsNationalCode(string code)
    {
        if (code.Length != 10 || !code.All(char.IsAsciiDigit) || code.Distinct().Count() == 1) return false;
        var sum = 0;
        for (var i = 0; i < 9; i++) sum += (code[i] - '0') * (10 - i);
        var r = sum % 11;
        var check = code[9] - '0';
        return r < 2 ? check == r : check == 11 - r;
    }

    private static string ToLatinDigits(string s)
    {
        var chars = s.ToCharArray();
        for (var i = 0; i < chars.Length; i++)
        {
            var c = chars[i];
            if (c is >= '۰' and <= '۹') chars[i] = (char)('0' + (c - '۰'));
            else if (c is >= '٠' and <= '٩') chars[i] = (char)('0' + (c - '٠'));
        }
        return new string(chars);
    }

    private static string? Limit(string? s, int max = MaxTextLength)
    {
        var t = s?.Trim();
        if (string.IsNullOrEmpty(t)) return null;
        return t.Length <= max ? t : t[..max];
    }
}
